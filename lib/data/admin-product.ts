import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");
export type Point = { label: string; value: number };

export type AdminProductDossier = {
  product: {
    id: string; title: string; brand: string; type: string; category: string | null; condition: string;
    description: string; color: string | null; size: string | null; price: number; currency: string;
    stock: number; hue: number; rating: number; isActive: boolean; images: string[]; tags: string[]; createdAt: string;
    sellerId: string;
    sanctions: Record<string, string>; // kind → 'perm' | ISO "until"
  };
  seller: { id: string; username: string; avatarUrl: string | null; role: string };
  stats: { timesOrdered: number; unitsSold: number; revenue: number; buyers: number; favorites: number; inCarts: number; cartUnits: number; reviews: number; rating: number };
  extra: { cancelled: number; cancelRate: number; repeatBuyers: number; avgSalePrice: number; firstSale: string | null; lastSale: string | null; daysSinceLastSale: number | null; sellThroughDays: number };
  funnel: { label: string; value: number; color: string }[];
  favoritedBy: { id: string; username: string; at: string }[];
  inCartBy: { id: string; username: string; qty: number }[];
  regions: { label: string; value: number }[];
  sales30d: Point[];
  byStatus: { status: string; count: number }[];
  recentOrders: { id: string; qty: number; total: number; status: string; buyer: string; created_at: string }[];
  reviewsList: { id: string; author: string; rating: number; body: string; photos: string[]; created_at: string }[];
  violations: { id: string; category: string; severity: number; detail: string; evidence: string | null; action: string; actionLabel: string; actionUntil: string | null; createdAt: string }[];
  taxonomy: { brands: string[]; colors: { name: string; hex: string }[]; categories: { slug: string; label: string }[] };
};

export async function getAdminProductDossier(id: string): Promise<AdminProductDossier | null> {
  const sb = createAdminClient();
  const { data: prod } = await sb.from("products").select("*").eq("id", id).maybeSingle();
  if (!prod) return null;

  const [sellerRes, itemsRes, revRes, favRes, cartRes, brandsRes, colorsRes, catsRes, violRes] = await Promise.all([
    sb.from("profiles").select("id,username,avatar_url,role").eq("id", prod.seller_id).maybeSingle(),
    sb.from("order_items").select("order_id,quantity,unit_price").eq("product_id", id).limit(5000),
    sb.from("product_reviews").select("id,author_id,rating,body,photos,created_at").eq("product_id", id).order("created_at", { ascending: false }).limit(200),
    sb.from("favorites").select("user_id,created_at").eq("product_id", id).order("created_at", { ascending: false }).limit(500),
    sb.from("cart_items").select("user_id,quantity").eq("product_id", id).limit(500),
    sb.from("brands").select("name").order("name"),
    sb.from("colors").select("name,hex").order("created_at"),
    sb.from("categories").select("id,name,slug,parent_id").order("sort"),
    sb.from("violations").select("id,category,severity,detail,evidence,action,action_label,action_until,created_at").eq("subject_id", id).order("created_at", { ascending: false }).limit(100),
  ]);

  const items = (itemsRes.data ?? []) as { order_id: string; quantity: number; unit_price: number }[];
  const orderIds = [...new Set(items.map((i) => i.order_id))];
  let orders: { id: string; user_id: string; status: string; region: string; created_at: string }[] = [];
  if (orderIds.length) {
    const { data } = await sb.from("orders").select("id,user_id,status,region,created_at").in("id", orderIds);
    orders = (data ?? []) as typeof orders;
  }
  const orderById = new Map(orders.map((o) => [o.id, o] as const));

  const favRows = (favRes.data ?? []) as { user_id: string; created_at: string }[];
  const cartRows = (cartRes.data ?? []) as { user_id: string; quantity: number }[];

  // resolve usernames for buyers + favoriters + cart holders in one shot
  const buyerIds = [...new Set(orders.map((o) => o.user_id))];
  const personIds = [...new Set([...buyerIds, ...favRows.map((f) => f.user_id), ...cartRows.map((c) => c.user_id)])];
  const buyerMap = new Map<string, string>();
  if (personIds.length) {
    const { data } = await sb.from("profiles").select("id,username").in("id", personIds);
    for (const b of (data ?? []) as { id: string; username: string }[]) buyerMap.set(b.id, b.username);
  }

  const now = Date.now();
  const sales30d: Point[] = [];
  for (let i = 29; i >= 0; i--) { const d = new Date(now - i * DAY); sales30d.push({ label: `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`, value: 0 }); }
  const byStatus = new Map<string, number>();
  const regionUnits = new Map<string, number>();
  const buyerOrders = new Map<string, number>();
  let unitsSold = 0, revenue = 0, cancelled = 0, soldQty = 0, soldValue = 0;
  let firstSaleMs: number | null = null, lastSaleMs: number | null = null;
  const buyers = new Set<string>();
  for (const it of items) {
    const o = orderById.get(it.order_id);
    const status = o?.status ?? "placed";
    const qty = Number(it.quantity ?? 0);
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    unitsSold += qty;
    if (status === "cancelled") { cancelled++; continue; }
    revenue += qty * Number(it.unit_price ?? 0);
    soldQty += qty; soldValue += qty * Number(it.unit_price ?? 0);
    if (o) {
      buyers.add(o.user_id);
      buyerOrders.set(o.user_id, (buyerOrders.get(o.user_id) ?? 0) + 1);
      regionUnits.set(o.region || "Dushanbe", (regionUnits.get(o.region || "Dushanbe") ?? 0) + qty);
      const t = new Date(o.created_at).getTime();
      if (firstSaleMs === null || t < firstSaleMs) firstSaleMs = t;
      if (lastSaleMs === null || t > lastSaleMs) lastSaleMs = t;
      const idx = 29 - Math.floor((now - t) / DAY); if (idx >= 0 && idx < 30) sales30d[idx].value += qty;
    }
  }
  const repeatBuyers = [...buyerOrders.values()].filter((n) => n > 1).length;
  const cartUserSet = new Set(cartRows.map((c) => c.user_id));
  const favSet = new Set(favRows.map((f) => f.user_id));

  const recentOrders = items.slice(0, 10).map((it) => {
    const o = orderById.get(it.order_id);
    return { id: it.order_id, qty: Number(it.quantity), total: Number(it.quantity) * Number(it.unit_price), status: o?.status ?? "placed", buyer: o ? buyerMap.get(o.user_id) ?? "user" : "—", created_at: o?.created_at ?? prod.created_at };
  }).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

  const revs = (revRes.data ?? []) as { id: string; author_id: string; rating: number; body: string; photos: string[]; created_at: string }[];
  const reviewAuthorIds = [...new Set(revs.map((r) => r.author_id))];
  const reviewAuthorMap = new Map<string, string>();
  if (reviewAuthorIds.length) {
    const { data } = await sb.from("profiles").select("id,username").in("id", reviewAuthorIds);
    for (const a of (data ?? []) as { id: string; username: string }[]) reviewAuthorMap.set(a.id, a.username);
  }
  const revCount = revs.length;
  const revAvg = revCount ? Math.round((revs.reduce((s, r) => s + Number(r.rating), 0) / revCount) * 10) / 10 : Number(prod.rating ?? 0);

  const cartUnits = cartRows.reduce((s, c) => s + Number(c.quantity ?? 0), 0);

  // named lists: who favorited / who has it in their cart
  const favoritedBy = favRows.map((f) => ({ id: f.user_id, username: buyerMap.get(f.user_id) ?? "user", at: f.created_at }));
  const cartQtyByUser = new Map<string, number>();
  for (const c of cartRows) cartQtyByUser.set(c.user_id, (cartQtyByUser.get(c.user_id) ?? 0) + Number(c.quantity ?? 1));
  const inCartBy = [...cartQtyByUser.entries()].map(([uid, qty]) => ({ id: uid, username: buyerMap.get(uid) ?? "user", qty }));

  // conversion funnel: interest → intent → purchase → loyalty
  const funnel = [
    { label: "Favorited", value: favSet.size, color: "#fb7185" },
    { label: "In cart", value: cartUserSet.size, color: "#fbbf24" },
    { label: "Bought", value: buyers.size, color: "#22ff88" },
    { label: "Repeat", value: repeatBuyers, color: "#a78bfa" },
  ];

  const daysSinceLastSale = lastSaleMs ? Math.floor((now - lastSaleMs) / DAY) : null;
  const sellThroughDays = soldQty > 0 && firstSaleMs ? Math.max(1, Math.round(((now - firstSaleMs) / DAY) / soldQty)) : 0;
  const extra = {
    cancelled,
    cancelRate: items.length ? Math.round((cancelled / items.length) * 100) : 0,
    repeatBuyers,
    avgSalePrice: soldQty ? Math.round(soldValue / soldQty) : Number(prod.price),
    firstSale: firstSaleMs ? new Date(firstSaleMs).toISOString() : null,
    lastSale: lastSaleMs ? new Date(lastSaleMs).toISOString() : null,
    daysSinceLastSale,
    sellThroughDays,
  };
  const regions = [...regionUnits.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6);

  const seller = sellerRes.data as { id: string; username: string; avatar_url: string | null; role: string } | null;

  // category options (flat, with "Section › Sub" labels)
  const cats = (catsRes.data ?? []) as { id: string; name: string; slug: string; parent_id: string | null }[];
  const nameById = new Map(cats.map((c) => [c.id, c.name] as const));
  const catOptions = cats
    .map((c) => ({ slug: c.slug, label: c.parent_id ? `${nameById.get(c.parent_id) ?? "—"} › ${c.name}` : c.name }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    product: {
      id: prod.id, title: prod.title, brand: prod.brand ?? "", type: prod.type, category: prod.category, condition: prod.condition,
      description: prod.description ?? "", color: prod.color, size: prod.size ?? null, price: Number(prod.price), currency: prod.currency,
      stock: prod.stock, hue: prod.hue ?? 200, rating: Number(prod.rating ?? 0), isActive: prod.is_active, images: prod.images ?? [], tags: prod.tags ?? [], createdAt: prod.created_at,
      sellerId: prod.seller_id,
      sanctions: (prod.sanctions ?? {}) as Record<string, string>,
    },
    seller: { id: seller?.id ?? prod.seller_id, username: seller?.username ?? "unknown", avatarUrl: seller?.avatar_url ?? null, role: seller?.role ?? "seller" },
    stats: { timesOrdered: items.length, unitsSold, revenue: Math.round(revenue), buyers: buyers.size, favorites: favSet.size, inCarts: cartUserSet.size, cartUnits, reviews: revCount, rating: revAvg },
    extra, funnel, favoritedBy, inCartBy, regions,
    sales30d, byStatus: [...byStatus.entries()].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
    recentOrders,
    reviewsList: revs.slice(0, 12).map((r) => ({ id: r.id, author: reviewAuthorMap.get(r.author_id) ?? "user", rating: r.rating, body: r.body, photos: r.photos ?? [], created_at: r.created_at })),
    violations: ((violRes.data ?? []) as { id: string; category: string; severity: number; detail: string; evidence: string | null; action: string; action_label: string; action_until: string | null; created_at: string }[])
      .map((v) => ({ id: v.id, category: v.category, severity: v.severity, detail: v.detail, evidence: v.evidence, action: v.action, actionLabel: v.action_label, actionUntil: v.action_until, createdAt: v.created_at })),
    taxonomy: {
      brands: (brandsRes.data ?? []).map((b: { name: string }) => b.name),
      colors: (colorsRes.data ?? []) as { name: string; hex: string }[],
      categories: catOptions,
    },
  };
}
