import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");
export type Point = { label: string; value: number };

export type AdminOrderRow = {
  id: string; buyer: string; buyerId: string; seller: string | null; sellerId: string | null;
  status: string; total: number; discount: number; region: string; promoCode: string | null;
  items: number; paid: boolean; createdAt: string;
};

export type AdminOrdersList = {
  summary: { total: number; revenue: number; aov: number; cancelled: number; today: number; last7d: number; inFlight: number; fulfilled: number };
  byStatus: { status: string; count: number }[];
  revenue30d: Point[];
  orders: AdminOrderRow[];
};

export async function getAdminOrdersList(): Promise<AdminOrdersList> {
  const sb = createAdminClient();
  const [ordRes, itemsRes] = await Promise.all([
    sb.from("orders").select("id,user_id,seller_id,status,total,discount,region,promo_code,paid_at,created_at").order("created_at", { ascending: false }).limit(5000),
    sb.from("order_items").select("order_id").limit(40000),
  ]);
  const orders = (ordRes.data ?? []) as { id: string; user_id: string; seller_id: string | null; status: string; total: number; discount: number; region: string; promo_code: string | null; paid_at: string | null; created_at: string }[];
  const items = (itemsRes.data ?? []) as { order_id: string }[];

  const itemCount = new Map<string, number>();
  for (const it of items) itemCount.set(it.order_id, (itemCount.get(it.order_id) ?? 0) + 1);

  const ids = [...new Set(orders.flatMap((o) => [o.user_id, o.seller_id]).filter(Boolean) as string[])];
  const nameMap = new Map<string, string>();
  if (ids.length) {
    const { data } = await sb.from("profiles").select("id,username").in("id", ids);
    for (const u of (data ?? []) as { id: string; username: string }[]) nameMap.set(u.id, u.username);
  }

  const now = Date.now();
  const revenue30d: Point[] = [];
  for (let i = 29; i >= 0; i--) { const d = new Date(now - i * DAY); revenue30d.push({ label: `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`, value: 0 }); }
  const byStatus = new Map<string, number>();
  let revenue = 0, cancelled = 0, today = 0, last7d = 0, inFlight = 0, fulfilled = 0, paidN = 0;
  for (const o of orders) {
    byStatus.set(o.status, (byStatus.get(o.status) ?? 0) + 1);
    const age = now - new Date(o.created_at).getTime();
    if (age < DAY) today++;
    if (age < 7 * DAY) last7d++;
    if (o.status === "cancelled") { cancelled++; continue; }
    revenue += Number(o.total ?? 0); paidN++;
    if (o.status === "fulfilled") fulfilled++;
    else if (["processing", "out_for_delivery", "arrived", "placed"].includes(o.status)) inFlight++;
    const idx = 29 - Math.floor(age / DAY); if (idx >= 0 && idx < 30) revenue30d[idx].value += Number(o.total ?? 0);
  }

  const rows: AdminOrderRow[] = orders.map((o) => ({
    id: o.id, buyer: nameMap.get(o.user_id) ?? "user", buyerId: o.user_id,
    seller: o.seller_id ? nameMap.get(o.seller_id) ?? "seller" : null, sellerId: o.seller_id,
    status: o.status, total: Number(o.total), discount: Number(o.discount ?? 0), region: o.region, promoCode: o.promo_code,
    items: itemCount.get(o.id) ?? 0, paid: !!o.paid_at, createdAt: o.created_at,
  }));

  return {
    summary: { total: orders.length, revenue: Math.round(revenue), aov: paidN ? Math.round(revenue / paidN) : 0, cancelled, today, last7d, inFlight, fulfilled },
    byStatus: [...byStatus.entries()].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
    revenue30d,
    orders: rows,
  };
}

/* ===================================================================== */
/* ORDER DOSSIER                                                          */
/* ===================================================================== */
export type AdminOrderDossier = {
  order: {
    id: string; status: string; subtotal: number; discount: number; deliveryFee: number; total: number; currency: string;
    promoCode: string | null; region: string; address: string; fullName: string; phone: string;
    cardLast4: string | null; cardBrand: string | null; createdAt: string; paidAt: string | null;
    cancelDeadline: string | null; cancelledAt: string | null; stockSettled: boolean;
  };
  buyer: { id: string; username: string; avatarUrl: string | null; email: string | null; phone: string | null } | null;
  seller: { id: string; username: string; avatarUrl: string | null } | null;
  courier: { name: string; phone: string; vehicle: string; distanceKm: number; etaMin: number };
  geo: { origin: Record<string, unknown>; destination: Record<string, unknown> };
  items: { id: string; productId: string; title: string; image: string; variant: string | null; qty: number; unitPrice: number }[];
  timeline: { id: string; kind: string; text: string; at: string; tone: string }[];
};

export async function getAdminOrderDossier(id: string): Promise<AdminOrderDossier | null> {
  const sb = createAdminClient();
  const { data: o } = await sb.from("orders").select("*").eq("id", id).maybeSingle();
  if (!o) return null;

  const [itemsRes, buyerRes, sellerRes] = await Promise.all([
    sb.from("order_items").select("id,product_id,title,image,variant_label,quantity,unit_price").eq("order_id", id).limit(200),
    sb.from("profiles").select("id,username,avatar_url,email,phone").eq("id", o.user_id).maybeSingle(),
    o.seller_id ? sb.from("profiles").select("id,username,avatar_url").eq("id", o.seller_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const items = ((itemsRes.data ?? []) as { id: string; product_id: string; title: string; image: string; variant_label: string | null; quantity: number; unit_price: number }[])
    .map((it) => ({ id: it.id, productId: it.product_id, title: it.title, image: it.image, variant: it.variant_label, qty: it.quantity, unitPrice: Number(it.unit_price) }));
  const buyerRow = buyerRes.data as { id: string; username: string; avatar_url: string | null; email: string | null; phone: string | null } | null;
  const sellerRow = (sellerRes as { data: { id: string; username: string; avatar_url: string | null } | null }).data;
  const buyer = buyerRow ? { id: buyerRow.id, username: buyerRow.username, avatarUrl: buyerRow.avatar_url, email: buyerRow.email, phone: buyerRow.phone } : null;
  const seller = sellerRow ? { id: sellerRow.id, username: sellerRow.username, avatarUrl: sellerRow.avatar_url } : null;

  const timeline = [
    { id: "created", kind: "PLACED", text: "Order placed", at: o.created_at, tone: "green" },
    ...(o.paid_at ? [{ id: "paid", kind: "PAID", text: `Paid ${Math.round(Number(o.total))} смн${o.card_brand ? ` · ${o.card_brand} ••${o.card_last4 ?? ""}` : ""}`, at: o.paid_at, tone: "cyan" }] : []),
    ...(o.cancel_deadline ? [{ id: "deadline", kind: "WINDOW", text: "Cancel window closes", at: o.cancel_deadline, tone: "amber" }] : []),
    ...(o.cancelled_at ? [{ id: "cancelled", kind: "CANCELLED", text: "Order cancelled", at: o.cancelled_at, tone: "red" }] : []),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return {
    order: {
      id: o.id, status: o.status, subtotal: Number(o.subtotal), discount: Number(o.discount), deliveryFee: Number(o.delivery_fee),
      total: Number(o.total), currency: o.currency, promoCode: o.promo_code, region: o.region, address: o.address,
      fullName: o.full_name, phone: o.phone, cardLast4: o.card_last4, cardBrand: o.card_brand, createdAt: o.created_at,
      paidAt: o.paid_at, cancelDeadline: o.cancel_deadline, cancelledAt: o.cancelled_at, stockSettled: !!o.stock_settled,
    },
    buyer,
    seller,
    courier: { name: o.courier_name, phone: o.courier_phone, vehicle: o.courier_vehicle, distanceKm: Number(o.distance_km ?? 0), etaMin: Number(o.eta_min ?? 0) },
    geo: { origin: (o.origin ?? {}) as Record<string, unknown>, destination: (o.destination ?? {}) as Record<string, unknown> },
    items,
    timeline,
  };
}
