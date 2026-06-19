import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type Point = { label: string; value: number };
export type Bar = { label: string; value: number; sub?: number; color?: string };

const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (t: number) => {
  const d = new Date(t);
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
};
export const PALETTE = ["#22ff88", "#38bdf8", "#a78bfa", "#fbbf24", "#fb7185", "#34d399", "#f472b6", "#60a5fa", "#facc15", "#2dd4bf"];

function emptySeries(days: number, now: number): Point[] {
  const out: Point[] = [];
  for (let i = days - 1; i >= 0; i--) out.push({ label: dayKey(now - i * DAY), value: 0 });
  return out;
}
function addTo(series: Point[], days: number, now: number, at: string, amount: number) {
  const idx = days - 1 - Math.floor((now - new Date(at).getTime()) / DAY);
  if (idx >= 0 && idx < series.length) series[idx].value += amount;
}
const prettySlug = (s: string) => s.replace(/^[a-z]+-/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/* ----------------------------------------------------------- shared core */
type Profile = { id: string; username: string; role: string; plan: string | null; loyalty_tier: string | null; is_verified: boolean | null; created_at: string };
type Order = { id: string; user_id: string; seller_id: string | null; total: number; status: string; region: string; full_name: string; created_at: string };
type Item = { product_id: string; title: string; image: string; quantity: number; unit_price: number };
type Product = { id: string; seller_id: string; title: string; brand: string; type: string; category: string | null; condition: string; price: number; stock: number; rating: number; is_active: boolean; created_at: string };
type Core = { profiles: Profile[]; orders: Order[]; items: Item[]; products: Product[]; promos: PromoRow[]; reports: ReportRow[]; counts: { products: number; activePromos: number; openReports: number; reviews: number } };
type PromoRow = { code: string; type: string; value: number; used_count: number; scope_label: string | null };
type ReportRow = { id: string; category: string; status: string; created_at: string };

async function loadCore(): Promise<Core> {
  const sb = createAdminClient();
  const head = { count: "exact" as const, head: true };
  const [profilesRes, ordersRes, itemsRes, productsRes, promosRes, reportsRes, productsC, promosC, reportsOpenC, reviewsC] =
    await Promise.all([
      sb.from("profiles").select("id,username,role,plan,loyalty_tier,is_verified,created_at").order("created_at", { ascending: false }).limit(5000),
      sb.from("orders").select("id,user_id,seller_id,total,status,region,full_name,created_at").order("created_at", { ascending: false }).limit(5000),
      sb.from("order_items").select("product_id,title,image,quantity,unit_price").limit(8000),
      sb.from("products").select("id,seller_id,title,brand,type,category,condition,price,stock,rating,is_active,created_at").limit(8000),
      sb.from("promo_codes").select("code,type,value,used_count,scope_label").eq("is_active", true).order("used_count", { ascending: false }).limit(12),
      sb.from("reports").select("id,category,status,created_at").order("created_at", { ascending: false }).limit(10),
      sb.from("products").select("*", head),
      sb.from("promo_codes").select("*", head).eq("is_active", true),
      sb.from("reports").select("*", head).in("status", ["open", "reviewing"]),
      sb.from("user_reviews").select("*", head),
    ]);
  return {
    profiles: (profilesRes.data ?? []) as Profile[],
    orders: (ordersRes.data ?? []) as Order[],
    items: (itemsRes.data ?? []) as Item[],
    products: (productsRes.data ?? []) as Product[],
    promos: (promosRes.data ?? []) as PromoRow[],
    reports: (reportsRes.data ?? []) as ReportRow[],
    counts: {
      products: productsC.count ?? 0,
      activePromos: promosC.count ?? 0,
      openReports: reportsOpenC.count ?? 0,
      reviews: reviewsC.count ?? 0,
    },
  };
}

function countBy<T>(rows: T[], key: (r: T) => string | null | undefined): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}
function toBars(m: Map<string, number>, limit = 99): Bar[] {
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, limit);
}

/* ===================================================================== */
/* DASHBOARD                                                              */
/* ===================================================================== */
export type AdminDashboard = {
  kpis: {
    revenue: number; gmv: number; orders: number; pendingOrders: number; users: number; newUsers30d: number;
    products: number; activePromos: number; openReports: number; avgOrder: number; fulfilledRate: number;
    cancelledRate: number; couriers: number; sellers: number; revenueGrowth: number; userGrowth: number;
  };
  revenue30d: Point[]; signups30d: Point[]; orders14d: Point[]; cumulative30d: Point[]; byHour: number[];
  ordersByStatus: { status: string; count: number }[];
  roles: { label: string; value: number; color: string }[];
  byRegion: Bar[]; productMix: { label: string; value: number; color: string }[];
  inventory: { totalStock: number; active: number; low: number; out: number };
  topProducts: { id: string; title: string; image: string; qty: number; revenue: number }[];
  topSpenders: { id: string; username: string; role: string; total: number; isAdmin: boolean }[];
  recentActivity: { id: string; kind: string; text: string; at: string; tone: string }[];
  promos: { code: string; type: string; value: number; used: number; label: string }[];
  recentUsers: { id: string; username: string; role: string; created_at: string; isAdmin: boolean }[];
  recentOrders: { id: string; total: number; status: string; full_name: string; created_at: string }[];
};

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const core = await loadCore();
  const now = Date.now();
  const since30 = now - 30 * DAY;
  const since60 = now - 60 * DAY;
  const { profiles, orders, items, products } = core;
  const nameOf = new Map(profiles.map((p) => [p.id, p] as const));

  const roleCount = countBy(profiles, (p) => p.role);
  let newUsers30d = 0;
  let prevUsers30d = 0;
  const signups30d = emptySeries(30, now);
  for (const p of profiles) {
    const t = new Date(p.created_at).getTime();
    if (t >= since30) newUsers30d++;
    else if (t >= since60) prevUsers30d++;
    addTo(signups30d, 30, now, p.created_at, 1);
  }

  const revenue30d = emptySeries(30, now);
  const orders14d = emptySeries(14, now);
  const byHour = new Array(24).fill(0);
  const statusCount = new Map<string, number>();
  const regionRev = new Map<string, number>();
  const spend = new Map<string, number>();
  let revenue = 0, gmv = 0, cancelled = 0, fulfilled = 0, rev30 = 0, revPrev30 = 0;
  for (const o of orders) {
    const total = Number(o.total ?? 0);
    const t = new Date(o.created_at).getTime();
    gmv += total;
    statusCount.set(o.status, (statusCount.get(o.status) ?? 0) + 1);
    byHour[new Date(o.created_at).getHours()] += 1;
    addTo(orders14d, 14, now, o.created_at, 1);
    if (o.status === "cancelled") { cancelled++; continue; }
    revenue += total;
    if (o.status === "fulfilled") fulfilled++;
    addTo(revenue30d, 30, now, o.created_at, total);
    regionRev.set(o.region || "Dushanbe", (regionRev.get(o.region || "Dushanbe") ?? 0) + total);
    spend.set(o.user_id, (spend.get(o.user_id) ?? 0) + total);
    if (t >= since30) rev30 += total;
    else if (t >= since60) revPrev30 += total;
  }
  const pendingOrders = (statusCount.get("placed") ?? 0) + (statusCount.get("processing") ?? 0);
  const nonCancelled = orders.length - cancelled;

  let cum = 0;
  const cumulative30d = revenue30d.map((p) => ({ label: p.label, value: (cum += p.value) }));

  const prodAgg = new Map<string, { title: string; image: string; qty: number; revenue: number }>();
  for (const it of items) {
    const cur = prodAgg.get(it.product_id) ?? { title: it.title, image: it.image, qty: 0, revenue: 0 };
    cur.qty += Number(it.quantity ?? 0);
    cur.revenue += Number(it.quantity ?? 0) * Number(it.unit_price ?? 0);
    prodAgg.set(it.product_id, cur);
  }
  const topProducts = [...prodAgg.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 6);

  const topSpenders = [...spend.entries()].map(([id, total]) => {
    const p = nameOf.get(id);
    return { id, username: p?.username ?? "unknown", role: p?.role ?? "customer", total, isAdmin: p?.role === "admin" };
  }).sort((a, b) => b.total - a.total).slice(0, 6);

  const typeMix = countBy(products, (p) => p.type);
  const productMix = [...typeMix.entries()].map(([label, value], i) => ({
    label: label.charAt(0).toUpperCase() + label.slice(1), value, color: PALETTE[i % PALETTE.length],
  }));

  const inventory = products.reduce(
    (a, p) => {
      if (!p.is_active) return a;
      a.active++; a.totalStock += p.stock;
      if (p.stock === 0) a.out++; else if (p.stock <= 3) a.low++;
      return a;
    },
    { totalStock: 0, active: 0, low: 0, out: 0 },
  );

  const recentUsers = profiles.slice(0, 8).map((p) => ({ id: p.id, username: p.username, role: p.role, created_at: p.created_at, isAdmin: p.role === "admin" }));
  const recentOrders = orders.slice(0, 8).map((o) => ({ id: o.id, total: Number(o.total), status: o.status, full_name: o.full_name, created_at: o.created_at }));
  const recentActivity = [
    ...recentOrders.slice(0, 6).map((o) => ({ id: `o-${o.id}`, kind: "ORDER", text: `Order #${o.id.slice(0, 8)} · ${Math.round(o.total)} смн · ${o.status.replace(/_/g, " ")}`, at: o.created_at, tone: o.status === "cancelled" ? "red" : "green" })),
    ...recentUsers.slice(0, 6).map((u) => ({ id: `u-${u.id}`, kind: "SIGNUP", text: `New ${u.role} @${u.username}`, at: u.created_at, tone: "cyan" })),
    ...core.reports.slice(0, 4).map((r) => ({ id: `r-${r.id}`, kind: "REPORT", text: `Report (${r.category}) · ${r.status}`, at: r.created_at, tone: "amber" })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 16);

  return {
    kpis: {
      revenue, gmv, orders: orders.length, pendingOrders, users: profiles.length, newUsers30d,
      products: core.counts.products, activePromos: core.counts.activePromos, openReports: core.counts.openReports,
      avgOrder: nonCancelled ? revenue / nonCancelled : 0,
      fulfilledRate: nonCancelled ? Math.round((fulfilled / nonCancelled) * 100) : 0,
      cancelledRate: orders.length ? Math.round((cancelled / orders.length) * 100) : 0,
      couriers: roleCount.get("courier") ?? 0, sellers: roleCount.get("seller") ?? 0,
      revenueGrowth: revPrev30 ? Math.round(((rev30 - revPrev30) / revPrev30) * 100) : rev30 > 0 ? 100 : 0,
      userGrowth: prevUsers30d ? Math.round(((newUsers30d - prevUsers30d) / prevUsers30d) * 100) : newUsers30d > 0 ? 100 : 0,
    },
    revenue30d, signups30d, orders14d, cumulative30d, byHour,
    ordersByStatus: [...statusCount.entries()].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
    roles: [
      { label: "Customers", value: roleCount.get("customer") ?? 0, color: "#22ff88" },
      { label: "Sellers", value: roleCount.get("seller") ?? 0, color: "#38bdf8" },
      { label: "Couriers", value: roleCount.get("courier") ?? 0, color: "#fbbf24" },
      { label: "Admins", value: roleCount.get("admin") ?? 0, color: "#a78bfa" },
    ],
    byRegion: [...regionRev.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6),
    productMix, inventory, topProducts, topSpenders, recentActivity,
    promos: core.promos.map((p) => ({ code: p.code, type: p.type, value: Number(p.value), used: p.used_count ?? 0, label: p.scope_label ?? "All catalog" })),
    recentUsers, recentOrders,
  };
}

/* ===================================================================== */
/* STATISTICS (deep page)                                                 */
/* ===================================================================== */
export type AdminStatistics = {
  totals: {
    revenue: number; gmv: number; orders: number; avgOrder: number; users: number; products: number;
    activeProducts: number; reviews: number; promos: number; couriers: number; sellers: number; buyers: number;
    cancelled: number; fulfilled: number; conversion: number; totalStock: number; lowStock: number; outOfStock: number;
    verified: number; avgRating: number; listedValue: number;
  };
  revenue90d: Point[]; orders90d: Point[]; signups90d: Point[]; cumulative90d: Point[]; aov30d: Point[];
  byHour: number[]; byWeekday: number[];
  statusFunnel: { label: string; value: number; color: string }[];
  roles: Bar[]; plans: Bar[]; tiers: Bar[];
  productTypes: { label: string; value: number; color: string }[];
  categories: Bar[]; brands: Bar[]; conditions: Bar[];
  regions: Bar[];
  topSellers: { id: string; username: string; revenue: number; orders: number; isAdmin: boolean }[];
  topProducts: { id: string; title: string; qty: number; revenue: number }[];
  topSpenders: { id: string; username: string; total: number; isAdmin: boolean }[];
  promos: { code: string; type: string; value: number; used: number; label: string }[];
  growth: { revenue: number; users: number; orders: number };
  priceBuckets: Point[]; ratingBuckets: Point[]; stockBuckets: Point[];
  buyerLoyalty: { label: string; value: number; color: string }[];
  verifiedSplit: { label: string; value: number; color: string }[];
  activeSplit: { label: string; value: number; color: string }[];
  regionShare: { label: string; value: number; color: string }[];
  extras: { avgItemsPerOrder: number; revenueConcentration: number; bestHour: number; bestDay: string; promoRedemptions: number; repeatBuyers: number; oneTimeBuyers: number };
};

export async function getAdminStatistics(): Promise<AdminStatistics> {
  const core = await loadCore();
  const now = Date.now();
  const since30 = now - 30 * DAY, since60 = now - 60 * DAY;
  const { profiles, orders, items, products } = core;
  const nameOf = new Map(profiles.map((p) => [p.id, p] as const));

  const revenue90d = emptySeries(90, now), orders90d = emptySeries(90, now), signups90d = emptySeries(90, now);
  const byHour = new Array(24).fill(0), byWeekday = new Array(7).fill(0);
  const statusCount = new Map<string, number>();
  const regionRev = new Map<string, number>();
  const sellerRev = new Map<string, number>(), sellerOrders = new Map<string, number>();
  const spend = new Map<string, number>();
  const buyers = new Set<string>();
  let revenue = 0, gmv = 0, cancelled = 0, fulfilled = 0, rev30 = 0, revPrev30 = 0, ord30 = 0, ordPrev30 = 0;

  for (const o of orders) {
    const total = Number(o.total ?? 0); const t = new Date(o.created_at).getTime(); const d = new Date(o.created_at);
    gmv += total;
    statusCount.set(o.status, (statusCount.get(o.status) ?? 0) + 1);
    byHour[d.getHours()]++; byWeekday[d.getDay()]++;
    addTo(orders90d, 90, now, o.created_at, 1);
    if (t >= since30) ord30++; else if (t >= since60) ordPrev30++;
    if (o.status === "cancelled") { cancelled++; continue; }
    revenue += total; buyers.add(o.user_id);
    if (o.status === "fulfilled") fulfilled++;
    addTo(revenue90d, 90, now, o.created_at, total);
    regionRev.set(o.region || "Dushanbe", (regionRev.get(o.region || "Dushanbe") ?? 0) + total);
    spend.set(o.user_id, (spend.get(o.user_id) ?? 0) + total);
    if (o.seller_id) { sellerRev.set(o.seller_id, (sellerRev.get(o.seller_id) ?? 0) + total); sellerOrders.set(o.seller_id, (sellerOrders.get(o.seller_id) ?? 0) + 1); }
    if (t >= since30) rev30 += total; else if (t >= since60) revPrev30 += total;
  }
  for (const p of profiles) addTo(signups90d, 90, now, p.created_at, 1);
  let newU30 = 0, prevU30 = 0;
  for (const p of profiles) { const t = new Date(p.created_at).getTime(); if (t >= since30) newU30++; else if (t >= since60) prevU30++; }

  let cum = 0;
  const cumulative90d = revenue90d.map((p) => ({ label: p.label, value: (cum += p.value) }));
  const aov30d = revenue90d.slice(60).map((p, i) => {
    const oc = orders90d.slice(60)[i].value;
    return { label: p.label, value: oc ? Math.round(p.value / oc) : 0 };
  });

  const prodAgg = new Map<string, { title: string; qty: number; revenue: number }>();
  for (const it of items) {
    const cur = prodAgg.get(it.product_id) ?? { title: it.title, qty: 0, revenue: 0 };
    cur.qty += Number(it.quantity ?? 0); cur.revenue += Number(it.quantity ?? 0) * Number(it.unit_price ?? 0);
    prodAgg.set(it.product_id, cur);
  }
  const topProducts = [...prodAgg.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 8);

  const topSellers = [...sellerRev.entries()].map(([id, revenueV]) => {
    const p = nameOf.get(id);
    return { id, username: p?.username ?? "unknown", revenue: revenueV, orders: sellerOrders.get(id) ?? 0, isAdmin: p?.role === "admin" };
  }).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  const topSpenders = [...spend.entries()].map(([id, total]) => {
    const p = nameOf.get(id);
    return { id, username: p?.username ?? "unknown", total, isAdmin: p?.role === "admin" };
  }).sort((a, b) => b.total - a.total).slice(0, 8);

  const roleCount = countBy(profiles, (p) => p.role);
  const typeMix = countBy(products, (p) => p.type);
  const inv = products.reduce((a, p) => { if (p.is_active) { a.active++; a.totalStock += p.stock; a.listedValue += p.stock * Number(p.price); if (p.stock === 0) a.out++; else if (p.stock <= 3) a.low++; } if (p.rating > 0) { a.ratingSum += Number(p.rating); a.ratingN++; } return a; },
    { active: 0, totalStock: 0, listedValue: 0, out: 0, low: 0, ratingSum: 0, ratingN: 0 });
  const nonCancelled = orders.length - cancelled;

  const FUNNEL = ["placed", "processing", "out_for_delivery", "arrived", "fulfilled"];
  const FUNNEL_COLOR: Record<string, string> = { placed: "#22ff88", processing: "#38bdf8", out_for_delivery: "#a78bfa", arrived: "#fbbf24", fulfilled: "#34d399" };

  // ---- extra deep analyses -------------------------------------------------
  const orderCountByUser = new Map<string, number>();
  for (const o of orders) if (o.status !== "cancelled") orderCountByUser.set(o.user_id, (orderCountByUser.get(o.user_id) ?? 0) + 1);
  let repeatBuyers = 0, onceBuyers = 0;
  for (const c of orderCountByUser.values()) { if (c > 1) repeatBuyers++; else onceBuyers++; }
  const totalItems = items.reduce((s, it) => s + Number(it.quantity ?? 0), 0);
  const avgItemsPerOrder = nonCancelled ? Math.round((totalItems / nonCancelled) * 10) / 10 : 0;
  const top5Spend = [...spend.values()].sort((a, b) => b - a).slice(0, 5).reduce((a, b) => a + b, 0);
  const revenueConcentration = revenue ? Math.round((top5Spend / revenue) * 100) : 0;
  const bestHour = byHour.indexOf(Math.max(0, ...byHour));
  const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const bestDay = WD[byWeekday.indexOf(Math.max(0, ...byWeekday))] ?? "—";
  const promoRedemptions = core.promos.reduce((s, p) => s + (p.used_count ?? 0), 0);
  const verifiedCount = profiles.filter((p) => p.is_verified).length;

  const priceEdges = [0, 100, 300, 700, 1500, 3000, Infinity];
  const priceLabels = ["<100", "100–300", "300–700", "700–1.5k", "1.5–3k", "3k+"];
  const priceBuckets: Point[] = priceLabels.map((label, i) => ({
    label, value: products.filter((p) => Number(p.price) >= priceEdges[i] && Number(p.price) < priceEdges[i + 1]).length,
  }));
  const ratingBuckets: Point[] = [0, 1, 2, 3, 4, 5].map((r) => ({
    label: r === 0 ? "none" : `${r}★`, value: products.filter((p) => Math.floor(Number(p.rating)) === r).length,
  }));
  const stockEdges = [0, 1, 4, 11, 51, Infinity];
  const stockLabels = ["0", "1–3", "4–10", "11–50", "50+"];
  const stockBuckets: Point[] = stockLabels.map((label, i) => ({
    label, value: products.filter((p) => p.stock >= stockEdges[i] && p.stock < stockEdges[i + 1]).length,
  }));
  const inactiveProducts = products.length - inv.active;

  return {
    totals: {
      revenue, gmv, orders: orders.length, avgOrder: nonCancelled ? Math.round(revenue / nonCancelled) : 0,
      users: profiles.length, products: core.counts.products, activeProducts: inv.active, reviews: core.counts.reviews,
      promos: core.counts.activePromos, couriers: roleCount.get("courier") ?? 0, sellers: roleCount.get("seller") ?? 0,
      buyers: buyers.size, cancelled, fulfilled, conversion: orders.length ? Math.round((fulfilled / orders.length) * 100) : 0,
      totalStock: inv.totalStock, lowStock: inv.low, outOfStock: inv.out,
      verified: profiles.filter((p) => p.is_verified).length, avgRating: inv.ratingN ? Math.round((inv.ratingSum / inv.ratingN) * 10) / 10 : 0,
      listedValue: Math.round(inv.listedValue),
    },
    revenue90d, orders90d, signups90d, cumulative90d, aov30d, byHour, byWeekday,
    statusFunnel: FUNNEL.map((s) => ({ label: s.replace(/_/g, " "), value: statusCount.get(s) ?? 0, color: FUNNEL_COLOR[s] })),
    roles: toBars(roleCount), plans: toBars(countBy(profiles, (p) => p.plan ?? "free")), tiers: toBars(countBy(profiles, (p) => p.loyalty_tier ?? "Bronze")),
    productTypes: [...typeMix.entries()].map(([label, value], i) => ({ label: label.charAt(0).toUpperCase() + label.slice(1), value, color: PALETTE[i % PALETTE.length] })),
    categories: toBars(countBy(products, (p) => (p.category ? prettySlug(p.category) : null)), 10),
    brands: toBars(countBy(products, (p) => (p.brand && p.brand.trim() ? p.brand : null)), 10),
    conditions: toBars(countBy(products, (p) => p.condition)),
    regions: [...regionRev.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8),
    topSellers, topProducts, topSpenders,
    promos: core.promos.map((p) => ({ code: p.code, type: p.type, value: Number(p.value), used: p.used_count ?? 0, label: p.scope_label ?? "All catalog" })),
    growth: {
      revenue: revPrev30 ? Math.round(((rev30 - revPrev30) / revPrev30) * 100) : rev30 > 0 ? 100 : 0,
      users: prevU30 ? Math.round(((newU30 - prevU30) / prevU30) * 100) : newU30 > 0 ? 100 : 0,
      orders: ordPrev30 ? Math.round(((ord30 - ordPrev30) / ordPrev30) * 100) : ord30 > 0 ? 100 : 0,
    },
    priceBuckets, ratingBuckets, stockBuckets,
    buyerLoyalty: [
      { label: "Repeat", value: repeatBuyers, color: "#22ff88" },
      { label: "One-time", value: onceBuyers, color: "#38bdf8" },
    ],
    verifiedSplit: [
      { label: "Verified", value: verifiedCount, color: "#34d399" },
      { label: "Unverified", value: Math.max(0, profiles.length - verifiedCount), color: "#475569" },
    ],
    activeSplit: [
      { label: "Active", value: inv.active, color: "#22ff88" },
      { label: "Inactive", value: Math.max(0, inactiveProducts), color: "#fb7185" },
    ],
    regionShare: [...regionRev.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value], i) => ({ label, value: Math.round(value), color: PALETTE[i % PALETTE.length] })),
    extras: { avgItemsPerOrder, revenueConcentration, bestHour, bestDay, promoRedemptions, repeatBuyers, oneTimeBuyers: onceBuyers },
  };
}
