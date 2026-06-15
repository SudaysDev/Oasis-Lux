import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lazy stock settlement: called when an order page loads. Once the 15-min cancel
 * window has closed on a non-cancelled order, decrement each live product's real
 * stock by the ordered quantity (exactly once) and advance the status.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let id: string | undefined;
  try {
    id = ((await req.json()) as { id?: string }).id;
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  // read via the user's session so RLS confirms ownership/visibility
  const { data: order } = await supabase
    .from("orders")
    .select("id,user_id,status,stock_settled,cancel_deadline,items:order_items(product_id,quantity)")
    .eq("id", id)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: "not found" }, { status: 404 });

  const o = order as {
    id: string; user_id: string; status: string; stock_settled: boolean;
    cancel_deadline: string | null; items: { product_id: string; quantity: number }[] | null;
  };

  if (o.user_id !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const windowClosed = o.cancel_deadline ? Date.now() >= new Date(o.cancel_deadline).getTime() : false;
  if (o.status === "cancelled" || o.stock_settled || !windowClosed) {
    return NextResponse.json({ settled: false, status: o.status });
  }

  const admin = createAdminClient();

  // decrement real stock for live (uuid) products only — demo seeds aren't in the DB
  for (const it of o.items ?? []) {
    if (!UUID_RE.test(it.product_id)) continue;
    const { data: prod } = await admin.from("products").select("stock").eq("id", it.product_id).maybeSingle();
    const current = (prod as { stock: number } | null)?.stock;
    if (typeof current === "number") {
      await admin.from("products").update({ stock: Math.max(0, current - it.quantity) }).eq("id", it.product_id);
    }
  }

  const nextStatus = o.status === "placed" ? "processing" : o.status;
  await admin.from("orders").update({ stock_settled: true, status: nextStatus }).eq("id", id);

  return NextResponse.json({ settled: true, status: nextStatus });
}
