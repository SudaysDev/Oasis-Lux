import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CANCEL_WINDOW_MIN, HUB, makeCourier, regionFee, regionLogistics, type OrderLine } from "@/lib/data/orders";
import { getOrCreateConversation, sendMessage } from "@/lib/data/messages";
import { findPromo, promoDiscount, promoMatchesProduct } from "@/lib/promo-codes";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Body {
  items: OrderLine[];
  region: string;
  address: string;
  fullName: string;
  phone: string;
  cardLast4?: string;
  cardBrand?: string;
  promoCode?: string;
  sellerId?: string | null;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const items = (body.items ?? []).filter((i) => i.productId && i.quantity > 0);
  if (items.length === 0) return NextResponse.json({ error: "empty order" }, { status: 400 });
  if (!body.address?.trim() || !body.fullName?.trim() || !body.phone?.trim()) {
    return NextResponse.json({ error: "missing delivery details" }, { status: 400 });
  }

  // recompute money server-side (never trust the client)
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const code = body.promoCode?.trim().toUpperCase();
  const def = code ? findPromo(code) : undefined;
  // a scoped promo (brand/category/product) only discounts MATCHING items — verify
  // against the real `products` rows so the client can't claim an unearned discount
  let applicable = subtotal;
  if (def && !def.locked && def.scope !== "all") {
    const uuids = items.map((i) => i.productId).filter((id) => UUID_RE.test(id));
    const meta = new Map<string, { brand: string | null; type: string | null; category: string | null; tags: string[] | null }>();
    if (uuids.length) {
      const { data } = await supabase.from("products").select("id,brand,type,category,tags").in("id", uuids);
      for (const r of (data ?? []) as { id: string; brand: string | null; type: string | null; category: string | null; tags: string[] | null }[]) {
        meta.set(r.id, { brand: r.brand, type: r.type, category: r.category, tags: r.tags });
      }
    }
    applicable = items.reduce((s, i) => {
      const m = meta.get(i.productId);
      return m && promoMatchesProduct(def, { id: i.productId, brand: m.brand ?? undefined, type: m.type ?? undefined, category: m.category ?? undefined, tags: m.tags ?? undefined })
        ? s + i.unitPrice * i.quantity
        : s;
    }, 0);
  }
  const discount = def && !def.locked ? promoDiscount(def, applicable) : 0;
  const region = regionFee(body.region) ? body.region : "Dushanbe";
  const deliveryFee = regionFee(region);
  const total = Math.max(0, subtotal - discount) + deliveryFee;
  const { distanceKm, etaMin, dest } = regionLogistics(region);
  const courier = makeCourier();
  const now = new Date();
  const cancelDeadline = new Date(now.getTime() + CANCEL_WINDOW_MIN * 60_000);

  const { data: orderRow, error } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      seller_id: body.sellerId ?? null,
      status: "placed",
      subtotal,
      discount,
      delivery_fee: deliveryFee,
      total,
      currency: "TJS",
      promo_code: discount > 0 ? code : null,
      region,
      address: body.address.trim(),
      full_name: body.fullName.trim(),
      phone: body.phone.trim(),
      card_last4: body.cardLast4 ?? null,
      card_brand: body.cardBrand ?? null,
      courier_name: courier.name,
      courier_phone: courier.phone,
      courier_vehicle: courier.vehicle,
      distance_km: distanceKm,
      eta_min: etaMin,
      origin: HUB,
      destination: dest,
      paid_at: now.toISOString(),
      cancel_deadline: cancelDeadline.toISOString(),
    })
    .select("id")
    .single();

  if (error || !orderRow) {
    return NextResponse.json({ error: error?.message ?? "could not create order" }, { status: 500 });
  }

  const orderId = (orderRow as { id: string }).id;

  const { error: itemsError } = await supabase.from("order_items").insert(
    items.map((i) => ({
      order_id: orderId,
      product_id: i.productId,
      title: i.title,
      image: i.image ?? "",
      variant_label: i.variantLabel ?? null,
      quantity: i.quantity,
      unit_price: i.unitPrice,
    })),
  );
  if (itemsError) {
    await supabase.from("orders").delete().eq("id", orderId);
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  // notify the seller (best-effort, service role bypasses RLS)
  if (body.sellerId) {
    void pingSeller(body.sellerId, user.id, body.fullName.trim(), items, total, orderId).catch(() => {});
  }

  return NextResponse.json({ id: orderId });
}

async function pingSeller(sellerId: string, buyerId: string, buyer: string, items: OrderLine[], total: number, orderId: string) {
  const admin = createAdminClient();
  const units = items.reduce((n, i) => n + i.quantity, 0);
  const list = items.map((i) => `• ${i.title} ×${i.quantity} — ${i.unitPrice * i.quantity} смн`).join("\n");
  const summary = `${buyer} ordered ${units} item${units > 1 ? "s" : ""} · ${total} смн`;
  const full = `🛍 New order\n${summary}\n${list}\nOrder #${orderId.slice(0, 8)}`;

  // read the seller's linked socials so we can fan out / record intended channels
  const { data: prof } = await admin
    .from("profiles")
    .select("telegram_chat_id, socials")
    .eq("id", sellerId)
    .maybeSingle();
  const p = prof as { telegram_chat_id: string | null; socials: Record<string, string> | null } | null;
  const socials = p?.socials ?? {};

  // 1) in-app notification — always delivered, lists the channels we'll alert
  await admin.from("notifications").insert({
    user_id: sellerId,
    type: "order",
    title: "New order received 🎉",
    body: summary,
    data: { orderId, items: list, channels: Object.keys(socials) },
  });

  // 2) in-site chat message from the buyer to the seller (real message in our
  //    own messenger — shows in both inboxes, like any DM).
  if (buyerId && buyerId !== sellerId) {
    try {
      const convId = await getOrCreateConversation(admin, buyerId, sellerId);
      await sendMessage(admin, convId, buyerId, sellerId, full);
    } catch { /* best-effort */ }
  }

  // 3) Telegram DM — real, but only if the seller connected the bot (we have a chat id).
  //    Instagram/TikTok/WhatsApp DMs require their paid/business APIs + recipient
  //    opt-in, so they can't be auto-sent for free — in-app + chat + Telegram are
  //    the live channels (the linked handles are recorded on the notification).
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = p?.telegram_chat_id;
  if (token && chatId) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: `🛍 OASIS LUX — new order!\n${summary}\n${list}\nOrder ${orderId}` }),
    }).catch(() => {});
  }
}
