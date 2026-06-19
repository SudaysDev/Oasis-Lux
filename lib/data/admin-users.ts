import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");

/* ===================================================================== */
/* USERS LIST                                                            */
/* ===================================================================== */
export type UserListRow = {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  role: string;
  plan: string;
  isVerified: boolean;
  loyaltyTier: string;
  createdAt: string;
  email: string | null;
  lastSeen: string | null;
  spent: number;
  orders: number;
  salesRevenue: number;
  salesCount: number;
  listings: number;
  ratingAvg: number;
  ratingCount: number;
  isAdmin: boolean;
};

export type AdminUsersList = {
  summary: { total: number; customers: number; sellers: number; couriers: number; admins: number; verified: number; withOrders: number; newToday: number; new7d: number };
  users: UserListRow[];
};

export async function getAdminUsersList(): Promise<AdminUsersList> {
  const sb = createAdminClient();
  const [profilesRes, ordersRes, productsRes, reviewsRes, authRes] = await Promise.all([
    sb.from("profiles").select("id,username,full_name,avatar_url,role,plan,is_verified,loyalty_tier,created_at,email").order("created_at", { ascending: false }).limit(5000),
    sb.from("orders").select("user_id,seller_id,total,status").limit(8000),
    sb.from("products").select("seller_id").limit(8000),
    sb.from("user_reviews").select("subject_id,rating").limit(8000),
    sb.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const profiles = (profilesRes.data ?? []) as { id: string; username: string; full_name: string | null; avatar_url: string | null; role: string; plan: string | null; is_verified: boolean | null; loyalty_tier: string | null; created_at: string; email: string | null }[];
  const orders = (ordersRes.data ?? []) as { user_id: string; seller_id: string | null; total: number; status: string }[];
  const products = (productsRes.data ?? []) as { seller_id: string }[];
  const reviews = (reviewsRes.data ?? []) as { subject_id: string; rating: number }[];
  const authUsers = (authRes.data?.users ?? []) as { id: string; last_sign_in_at?: string | null; email?: string | null }[];
  const lastSeenOf = new Map(authUsers.map((u) => [u.id, u.last_sign_in_at ?? null] as const));

  const spent = new Map<string, number>(), ordersN = new Map<string, number>();
  const salesRev = new Map<string, number>(), salesN = new Map<string, number>();
  for (const o of orders) {
    if (o.status !== "cancelled") {
      spent.set(o.user_id, (spent.get(o.user_id) ?? 0) + Number(o.total ?? 0));
      if (o.seller_id) salesRev.set(o.seller_id, (salesRev.get(o.seller_id) ?? 0) + Number(o.total ?? 0));
    }
    ordersN.set(o.user_id, (ordersN.get(o.user_id) ?? 0) + 1);
    if (o.seller_id) salesN.set(o.seller_id, (salesN.get(o.seller_id) ?? 0) + 1);
  }
  const listings = new Map<string, number>();
  for (const p of products) listings.set(p.seller_id, (listings.get(p.seller_id) ?? 0) + 1);
  const ratingSum = new Map<string, number>(), ratingCnt = new Map<string, number>();
  for (const r of reviews) {
    ratingSum.set(r.subject_id, (ratingSum.get(r.subject_id) ?? 0) + Number(r.rating ?? 0));
    ratingCnt.set(r.subject_id, (ratingCnt.get(r.subject_id) ?? 0) + 1);
  }

  const now = Date.now();
  const users: UserListRow[] = profiles.map((p) => ({
    id: p.id,
    username: p.username,
    fullName: p.full_name ?? "",
    avatarUrl: p.avatar_url,
    role: p.role,
    plan: p.plan ?? "free",
    isVerified: !!p.is_verified,
    loyaltyTier: p.loyalty_tier ?? "Bronze",
    createdAt: p.created_at,
    email: p.email,
    lastSeen: lastSeenOf.get(p.id) ?? null,
    spent: Math.round(spent.get(p.id) ?? 0),
    orders: ordersN.get(p.id) ?? 0,
    salesRevenue: Math.round(salesRev.get(p.id) ?? 0),
    salesCount: salesN.get(p.id) ?? 0,
    listings: listings.get(p.id) ?? 0,
    ratingCount: ratingCnt.get(p.id) ?? 0,
    ratingAvg: ratingCnt.get(p.id) ? Math.round((ratingSum.get(p.id)! / ratingCnt.get(p.id)!) * 10) / 10 : 0,
    isAdmin: p.role === "admin",
  }));

  const summary = {
    total: users.length,
    customers: users.filter((u) => u.role === "customer").length,
    sellers: users.filter((u) => u.role === "seller").length,
    couriers: users.filter((u) => u.role === "courier").length,
    admins: users.filter((u) => u.role === "admin").length,
    verified: users.filter((u) => u.isVerified).length,
    withOrders: users.filter((u) => u.orders > 0).length,
    newToday: users.filter((u) => now - new Date(u.createdAt).getTime() < DAY).length,
    new7d: users.filter((u) => now - new Date(u.createdAt).getTime() < 7 * DAY).length,
  };
  return { summary, users };
}

/* ===================================================================== */
/* USER DOSSIER (single account, everything)                             */
/* ===================================================================== */
export type Point = { label: string; value: number };
export type AdminUserDossier = {
  profile: {
    id: string; username: string; fullName: string; avatarUrl: string | null; bannerUrl: string | null; bio: string;
    role: string; plan: string; isVerified: boolean; loyaltyTier: string; loyaltyPoints: number; cashbackBalance: number;
    email: string | null; phone: string | null; socials: Record<string, string>; locale: string; theme: string;
    birthday: string | null; createdAt: string; isAdmin: boolean;
  };
  auth: { lastSignIn: string | null; emailConfirmed: boolean; authCreatedAt: string | null };
  buyer: { spent: number; orders: number; avgOrder: number; byStatus: { status: string; count: number }[]; spend30d: Point[]; regions: { label: string; value: number }[]; recent: { id: string; total: number; status: string; created_at: string }[] };
  seller: { revenue: number; sales: number; listings: number; totalStock: number; listedValue: number; avgRating: number; recentListings: { id: string; title: string; price: number; stock: number; type: string; is_active: boolean }[]; recentSales: { id: string; total: number; status: string; created_at: string }[] };
  reviews: { count: number; avg: number; items: { id: string; rating: number; body: string; author: string; created_at: string }[] };
  chats: { conversations: number; messagesSent: number; threads: { id: string; other: string; otherId: string; lastMessage: string; lastAt: string; count: number; mine: number }[]; recent: { id: string; from: string; text: string; created_at: string; mine: boolean }[] };
  counts: { notifications: number; favorites: number; cart: number };
  timeline: { id: string; kind: string; text: string; at: string; tone: string }[];
};

function bucket30(now: number, rows: { at: string; amount: number }[]): Point[] {
  const out: Point[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * DAY);
    out.push({ label: `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`, value: 0 });
  }
  for (const r of rows) {
    const idx = 29 - Math.floor((now - new Date(r.at).getTime()) / DAY);
    if (idx >= 0 && idx < 30) out[idx].value += r.amount;
  }
  return out;
}

export async function getAdminUserDossier(id: string): Promise<AdminUserDossier | null> {
  const sb = createAdminClient();
  const { data: prof } = await sb.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!prof) return null;

  const head = { count: "exact" as const, head: true };
  const [buyRes, sellRes, prodRes, revRes, convRes, sentC, notifC, favC, cartC, authRes] = await Promise.all([
    sb.from("orders").select("id,total,status,region,created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(2000),
    sb.from("orders").select("id,total,status,created_at").eq("seller_id", id).order("created_at", { ascending: false }).limit(2000),
    sb.from("products").select("id,title,price,stock,type,rating,is_active,created_at").eq("seller_id", id).order("created_at", { ascending: false }).limit(2000),
    sb.from("user_reviews").select("id,rating,body,author_id,created_at").eq("subject_id", id).order("created_at", { ascending: false }).limit(200),
    sb.from("conversations").select("id,user_a,user_b,last_message,last_at").or(`user_a.eq.${id},user_b.eq.${id}`).order("last_at", { ascending: false }).limit(200),
    sb.from("messages").select("*", head).eq("sender_id", id),
    sb.from("notifications").select("*", head).eq("user_id", id),
    sb.from("favorites").select("*", head).eq("user_id", id),
    sb.from("cart_items").select("*", head).eq("user_id", id),
    sb.auth.admin.getUserById(id),
  ]);

  const now = Date.now();
  const buy = (buyRes.data ?? []) as { id: string; total: number; status: string; region: string; created_at: string }[];
  const sell = (sellRes.data ?? []) as { id: string; total: number; status: string; created_at: string }[];
  const prods = (prodRes.data ?? []) as { id: string; title: string; price: number; stock: number; type: string; rating: number; is_active: boolean; created_at: string }[];
  const revs = (revRes.data ?? []) as { id: string; rating: number; body: string; author_id: string; created_at: string }[];
  const convs = (convRes.data ?? []) as { id: string; user_a: string; user_b: string; last_message: string; last_at: string }[];

  // buyer aggregates
  const byStatus = new Map<string, number>();
  const regions = new Map<string, number>();
  let spent = 0, cancelled = 0;
  for (const o of buy) {
    byStatus.set(o.status, (byStatus.get(o.status) ?? 0) + 1);
    if (o.status === "cancelled") cancelled++;
    else { spent += Number(o.total ?? 0); regions.set(o.region || "Dushanbe", (regions.get(o.region || "Dushanbe") ?? 0) + Number(o.total ?? 0)); }
  }
  const nonCancelled = buy.length - cancelled;
  const spend30d = bucket30(now, buy.filter((o) => o.status !== "cancelled").map((o) => ({ at: o.created_at, amount: Number(o.total ?? 0) })));

  // seller aggregates
  let sellRev = 0;
  for (const o of sell) if (o.status !== "cancelled") sellRev += Number(o.total ?? 0);
  const inv = prods.reduce((a, p) => { if (p.is_active) { a.stock += p.stock; a.value += p.stock * Number(p.price); } if (p.rating > 0) { a.rs += Number(p.rating); a.rn++; } return a; }, { stock: 0, value: 0, rs: 0, rn: 0 });

  // reviews — resolve author usernames
  const authorIds = [...new Set(revs.map((r) => r.author_id))];
  const authorMap = new Map<string, string>();
  if (authorIds.length) {
    const { data: authors } = await sb.from("profiles").select("id,username").in("id", authorIds);
    for (const a of (authors ?? []) as { id: string; username: string }[]) authorMap.set(a.id, a.username);
  }
  const revCount = revs.length;
  const revAvg = revCount ? Math.round((revs.reduce((s, r) => s + Number(r.rating ?? 0), 0) / revCount) * 10) / 10 : 0;

  // chats — resolve other usernames + per-conversation message stats
  const otherIds = [...new Set(convs.map((c) => (c.user_a === id ? c.user_b : c.user_a)))];
  const otherMap = new Map<string, string>();
  if (otherIds.length) {
    const { data: others } = await sb.from("profiles").select("id,username").in("id", otherIds);
    for (const o of (others ?? []) as { id: string; username: string }[]) otherMap.set(o.id, o.username);
  }
  const convIds = convs.map((c) => c.id);
  let msgs: { id: string; conversation_id: string; sender_id: string; text: string; created_at: string }[] = [];
  if (convIds.length) {
    const { data: m } = await sb.from("messages").select("id,conversation_id,sender_id,text,created_at").in("conversation_id", convIds).order("created_at", { ascending: false }).limit(3000);
    msgs = (m ?? []) as typeof msgs;
  }
  const perConv = new Map<string, { count: number; mine: number }>();
  for (const m of msgs) {
    const e = perConv.get(m.conversation_id) ?? { count: 0, mine: 0 };
    e.count++; if (m.sender_id === id) e.mine++;
    perConv.set(m.conversation_id, e);
  }
  const threads = convs.map((c) => {
    const otherId = c.user_a === id ? c.user_b : c.user_a;
    const pc = perConv.get(c.id) ?? { count: 0, mine: 0 };
    return { id: c.id, other: otherMap.get(otherId) ?? "unknown", otherId, lastMessage: c.last_message, lastAt: c.last_at, count: pc.count, mine: pc.mine };
  });
  const recentMsgs = msgs.slice(0, 14).map((m) => ({
    id: m.id,
    from: m.sender_id === id ? prof.username : otherMap.get(m.sender_id) ?? "peer",
    text: m.text,
    created_at: m.created_at,
    mine: m.sender_id === id,
  }));

  // timeline
  const timeline = [
    ...buy.slice(0, 6).map((o) => ({ id: `b-${o.id}`, kind: "ORDER", text: `Ordered · ${Math.round(o.total)} смн · ${o.status.replace(/_/g, " ")}`, at: o.created_at, tone: o.status === "cancelled" ? "red" : "green" })),
    ...sell.slice(0, 5).map((o) => ({ id: `s-${o.id}`, kind: "SALE", text: `Sold · ${Math.round(o.total)} смн · ${o.status.replace(/_/g, " ")}`, at: o.created_at, tone: "cyan" })),
    ...prods.slice(0, 5).map((p) => ({ id: `p-${p.id}`, kind: "LISTING", text: `Listed “${p.title}” · ${Math.round(Number(p.price))} смн`, at: p.created_at, tone: "violet" })),
    ...revs.slice(0, 4).map((r) => ({ id: `r-${r.id}`, kind: "REVIEW", text: `Got ${r.rating}★ from @${authorMap.get(r.author_id) ?? "user"}`, at: r.created_at, tone: "amber" })),
    { id: "join", kind: "JOIN", text: "Joined OASIS LUX", at: prof.created_at, tone: "green" },
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 18);

  const authUser = authRes.data?.user as { last_sign_in_at?: string | null; email_confirmed_at?: string | null; created_at?: string | null } | undefined;

  return {
    profile: {
      id: prof.id, username: prof.username, fullName: prof.full_name ?? "", avatarUrl: prof.avatar_url, bannerUrl: prof.banner_url, bio: prof.bio ?? "",
      role: prof.role, plan: prof.plan ?? "free", isVerified: !!prof.is_verified, loyaltyTier: prof.loyalty_tier ?? "Bronze",
      loyaltyPoints: prof.loyalty_points ?? 0, cashbackBalance: Number(prof.cashback_balance ?? 0),
      email: prof.email, phone: prof.phone, socials: (prof.socials ?? {}) as Record<string, string>, locale: prof.locale, theme: prof.theme,
      birthday: prof.birthday, createdAt: prof.created_at, isAdmin: prof.role === "admin",
    },
    auth: { lastSignIn: authUser?.last_sign_in_at ?? null, emailConfirmed: !!authUser?.email_confirmed_at, authCreatedAt: authUser?.created_at ?? null },
    buyer: {
      spent: Math.round(spent), orders: buy.length, avgOrder: nonCancelled ? Math.round(spent / nonCancelled) : 0,
      byStatus: [...byStatus.entries()].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
      spend30d, regions: [...regions.entries()].map(([label, value]) => ({ label, value: Math.round(value) })).sort((a, b) => b.value - a.value).slice(0, 5),
      recent: buy.slice(0, 8).map((o) => ({ id: o.id, total: Number(o.total), status: o.status, created_at: o.created_at })),
    },
    seller: {
      revenue: Math.round(sellRev), sales: sell.length, listings: prods.length, totalStock: inv.stock, listedValue: Math.round(inv.value),
      avgRating: inv.rn ? Math.round((inv.rs / inv.rn) * 10) / 10 : 0,
      recentListings: prods.slice(0, 8).map((p) => ({ id: p.id, title: p.title, price: Number(p.price), stock: p.stock, type: p.type, is_active: p.is_active })),
      recentSales: sell.slice(0, 8).map((o) => ({ id: o.id, total: Number(o.total), status: o.status, created_at: o.created_at })),
    },
    reviews: { count: revCount, avg: revAvg, items: revs.slice(0, 10).map((r) => ({ id: r.id, rating: r.rating, body: r.body, author: authorMap.get(r.author_id) ?? "user", created_at: r.created_at })) },
    chats: {
      conversations: convs.length, messagesSent: sentC.count ?? 0,
      threads: threads.slice(0, 20), recent: recentMsgs,
    },
    counts: { notifications: notifC.count ?? 0, favorites: favC.count ?? 0, cart: cartC.count ?? 0 },
    timeline,
  };
}
