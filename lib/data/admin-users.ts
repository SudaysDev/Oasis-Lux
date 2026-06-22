import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOwnerEmail } from "@/lib/auth/admin-accounts";

const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");
/** A jsonb sanction value ('perm' | ISO until) is active when permanent or not yet expired. */
const sancActive = (v: string | undefined | null): boolean => !!v && (v === "perm" || new Date(v) > new Date());

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
  isBanned: boolean;
  restricted: boolean;
  restrictChat: boolean;
  restrictSell: boolean;
  restrictBuy: boolean;
};

export type AdminUsersList = {
  summary: { total: number; customers: number; sellers: number; couriers: number; admins: number; verified: number; withOrders: number; newToday: number; new7d: number; banned: number; restricted: number };
  users: UserListRow[];
};

export async function getAdminUsersList(): Promise<AdminUsersList> {
  const sb = createAdminClient();
  const [profilesRes, ordersRes, productsRes, reviewsRes, authRes] = await Promise.all([
    sb.from("profiles").select("id,username,full_name,avatar_url,role,plan,is_verified,loyalty_tier,created_at,email,is_banned,ban_until,restrictions").order("created_at", { ascending: false }).limit(5000),
    sb.from("orders").select("user_id,seller_id,total,status").limit(8000),
    sb.from("products").select("seller_id").limit(8000),
    sb.from("user_reviews").select("subject_id,rating").limit(8000),
    sb.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const profiles = (profilesRes.data ?? []) as { id: string; username: string; full_name: string | null; avatar_url: string | null; role: string; plan: string | null; is_verified: boolean | null; loyalty_tier: string | null; created_at: string; email: string | null; is_banned: boolean | null; ban_until: string | null; restrictions: Record<string, string> | null }[];
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
    isBanned: !!p.is_banned || (!!p.ban_until && new Date(p.ban_until) > new Date()),
    restricted: Object.values(p.restrictions ?? {}).some(sancActive),
    restrictChat: sancActive((p.restrictions ?? {}).chat),
    restrictSell: sancActive((p.restrictions ?? {}).sell),
    restrictBuy: sancActive((p.restrictions ?? {}).buy),
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
    banned: users.filter((u) => u.isBanned).length,
    restricted: users.filter((u) => u.restricted).length,
  };
  return { summary, users };
}

/* ===================================================================== */
/* USER DOSSIER (single account, everything)                             */
/* ===================================================================== */
export type Point = { label: string; value: number };
export type Tally = { value: string; count: number };
export type ModReport = { id: string; other: string; otherId: string; category: string; description: string; status: string; created_at: string };
export type AdminUserDossier = {
  profile: {
    id: string; username: string; fullName: string; avatarUrl: string | null; bannerUrl: string | null; bio: string;
    role: string; plan: string; isVerified: boolean; loyaltyTier: string; loyaltyPoints: number; cashbackBalance: number;
    email: string | null; phone: string | null; showPhone: boolean; socials: Record<string, string>; links: { label: string; url: string }[];
    telegramChatId: string | null; locale: string; theme: string; birthday: string | null; createdAt: string; isAdmin: boolean; isOwner: boolean;
    isBanned: boolean; bannedAt: string | null; banReason: string | null; banUntil: string | null;
    restrictions: Record<string, string>; // kind → 'perm' | ISO "until"
    adminNote: string;
  };
  auth: { lastSignIn: string | null; emailConfirmed: boolean; authCreatedAt: string | null; authEmail: string | null; authPhone: string | null; phoneConfirmed: boolean; providers: string[]; metaRole: string | null };
  buyer: { spent: number; orders: number; avgOrder: number; cancelled: number; cancelRate: number; repeatRate: number; byStatus: { status: string; count: number }[]; spend30d: Point[]; regions: { label: string; value: number }[]; recent: { id: string; total: number; status: string; created_at: string }[] };
  seller: { revenue: number; sales: number; listings: number; totalStock: number; listedValue: number; avgRating: number; recentListings: { id: string; title: string; price: number; stock: number; type: string; is_active: boolean }[]; recentSales: { id: string; total: number; status: string; created_at: string }[] };
  reviews: { count: number; avg: number; items: { id: string; rating: number; body: string; author: string; created_at: string }[] };
  chats: { conversations: number; messagesSent: number; threads: { id: string; other: string; otherId: string; lastMessage: string; lastAt: string; count: number; mine: number }[]; recent: { id: string; from: string; text: string; created_at: string; mine: boolean }[] };
  counts: { notifications: number; favorites: number; cart: number };
  personal: { addresses: Tally[]; phones: Tally[]; names: Tally[]; cards: Tally[] };
  cart: { id: string; title: string; qty: number }[];
  favorites: { id: string; title: string }[];
  moderation: { blocking: { id: string; username: string; at: string }[]; blockedBy: { id: string; username: string; at: string }[]; reportsFiled: ModReport[]; reportsAgainst: ModReport[]; riskScore: number; riskFactors: string[] };
  usernameHistory: { old: string | null; current: string; at: string }[];
  violations: { id: string; subjectType: string; category: string; severity: number; detail: string; evidence: string | null; action: string; actionLabel: string; actionUntil: string | null; createdAt: string }[];
  raw: { key: string; value: string }[];
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
  const [buyRes, sellRes, prodRes, revRes, convRes, sentC, notifC, favC, cartC, authRes,
         cartRes, favRes, blkOutRes, blkInRes, repFiledRes, repAgainstRes, unameRes, violRes] = await Promise.all([
    sb.from("orders").select("id,total,status,region,address,full_name,phone,card_last4,card_brand,created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(2000),
    sb.from("orders").select("id,total,status,created_at").eq("seller_id", id).order("created_at", { ascending: false }).limit(2000),
    sb.from("products").select("id,title,price,stock,type,rating,is_active,created_at").eq("seller_id", id).order("created_at", { ascending: false }).limit(2000),
    sb.from("user_reviews").select("id,rating,body,author_id,created_at").eq("subject_id", id).order("created_at", { ascending: false }).limit(200),
    sb.from("conversations").select("id,user_a,user_b,last_message,last_at").or(`user_a.eq.${id},user_b.eq.${id}`).order("last_at", { ascending: false }).limit(200),
    sb.from("messages").select("*", head).eq("sender_id", id),
    sb.from("notifications").select("*", head).eq("user_id", id),
    sb.from("favorites").select("*", head).eq("user_id", id),
    sb.from("cart_items").select("*", head).eq("user_id", id),
    sb.auth.admin.getUserById(id),
    sb.from("cart_items").select("product_id,quantity").eq("user_id", id).limit(200),
    sb.from("favorites").select("product_id,created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(200),
    sb.from("blocks").select("blocked_id,created_at").eq("blocker_id", id).limit(200),
    sb.from("blocks").select("blocker_id,created_at").eq("blocked_id", id).limit(200),
    sb.from("reports").select("id,reported_id,category,description,status,created_at").eq("reporter_id", id).order("created_at", { ascending: false }).limit(100),
    sb.from("reports").select("id,reporter_id,category,description,status,created_at").eq("reported_id", id).order("created_at", { ascending: false }).limit(100),
    sb.from("username_history").select("old_username,new_username,changed_at").eq("user_id", id).order("changed_at", { ascending: false }).limit(50),
    sb.from("violations").select("id,subject_type,category,severity,detail,evidence,action,action_label,action_until,created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(100),
  ]);

  const now = Date.now();
  const buy = (buyRes.data ?? []) as { id: string; total: number; status: string; region: string; address: string; full_name: string; phone: string; card_last4: string | null; card_brand: string | null; created_at: string }[];
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
  const cancelRate = buy.length ? Math.round((cancelled / buy.length) * 100) : 0;
  const repeatRate = nonCancelled > 1 ? Math.round(((nonCancelled - 1) / nonCancelled) * 100) : 0;
  const spend30d = bucket30(now, buy.filter((o) => o.status !== "cancelled").map((o) => ({ at: o.created_at, amount: Number(o.total ?? 0) })));

  // ---- personal data harvested from real orders (addresses / phones / cards) ----
  const tally = (vals: (string | null | undefined)[]): Tally[] => {
    const m = new Map<string, number>();
    for (const v of vals) { const k = (v ?? "").trim(); if (k) m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
  };
  const personal = {
    addresses: tally(buy.map((o) => o.address)),
    phones: tally(buy.map((o) => o.phone)),
    names: tally(buy.map((o) => o.full_name)),
    cards: tally(buy.map((o) => (o.card_last4 ? `${o.card_brand || "Card"} •••• ${o.card_last4}` : null))),
  };

  // ---- itemized cart + favorites (what they're eyeing right now) ----
  const cartRows = (cartRes.data ?? []) as { product_id: string; quantity: number }[];
  const favRows = (favRes.data ?? []) as { product_id: string; created_at: string }[];
  const pids = [...new Set([...cartRows.map((c) => c.product_id), ...favRows.map((f) => f.product_id)])];
  const titleMap = new Map<string, string>();
  const uuids = pids.filter((p) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p));
  if (uuids.length) {
    const { data } = await sb.from("products").select("id,title").in("id", uuids);
    for (const p of (data ?? []) as { id: string; title: string }[]) titleMap.set(p.id, p.title);
  }
  const cart = cartRows.map((c) => ({ id: c.product_id, title: titleMap.get(c.product_id) ?? c.product_id, qty: Number(c.quantity ?? 1) }));
  const favorites = favRows.map((f) => ({ id: f.product_id, title: titleMap.get(f.product_id) ?? f.product_id }));

  // ---- moderation footprint: blocks + reports both directions ----
  const blkOut = (blkOutRes.data ?? []) as { blocked_id: string; created_at: string }[];
  const blkIn = (blkInRes.data ?? []) as { blocker_id: string; created_at: string }[];
  const repFiled = (repFiledRes.data ?? []) as { id: string; reported_id: string; category: string; description: string; status: string; created_at: string }[];
  const repAgainst = (repAgainstRes.data ?? []) as { id: string; reporter_id: string; category: string; description: string; status: string; created_at: string }[];
  const modIds = [...new Set([...blkOut.map((b) => b.blocked_id), ...blkIn.map((b) => b.blocker_id), ...repFiled.map((r) => r.reported_id), ...repAgainst.map((r) => r.reporter_id)])];
  const modNames = new Map<string, string>();
  if (modIds.length) {
    const { data } = await sb.from("profiles").select("id,username").in("id", modIds);
    for (const p of (data ?? []) as { id: string; username: string }[]) modNames.set(p.id, p.username);
  }
  const blocking = blkOut.map((b) => ({ id: b.blocked_id, username: modNames.get(b.blocked_id) ?? "user", at: b.created_at }));
  const blockedBy = blkIn.map((b) => ({ id: b.blocker_id, username: modNames.get(b.blocker_id) ?? "user", at: b.created_at }));
  const reportsFiled = repFiled.map((r) => ({ id: r.id, other: modNames.get(r.reported_id) ?? "user", otherId: r.reported_id, category: r.category, description: r.description, status: r.status, created_at: r.created_at }));
  const reportsAgainst = repAgainst.map((r) => ({ id: r.id, other: modNames.get(r.reporter_id) ?? "user", otherId: r.reporter_id, category: r.category, description: r.description, status: r.status, created_at: r.created_at }));

  // ---- composite risk score (0–100) ----
  const riskFactors: string[] = [];
  let risk = 0;
  if (prof.is_banned) { risk += 45; riskFactors.push("Account is banned"); }
  if (reportsAgainst.length) { risk += Math.min(30, reportsAgainst.length * 10); riskFactors.push(`${reportsAgainst.length} report(s) filed against`); }
  if (blockedBy.length) { risk += Math.min(20, blockedBy.length * 5); riskFactors.push(`Blocked by ${blockedBy.length} user(s)`); }
  if (cancelRate >= 40 && buy.length >= 3) { risk += 15; riskFactors.push(`High cancel rate (${cancelRate}%)`); }
  if (prof.ban_until && new Date(prof.ban_until) > new Date()) { risk += 35; riskFactors.push("Temporarily banned"); }
  const activeRestrictions = Object.values((prof.restrictions ?? {}) as Record<string, string>).filter(sancActive).length;
  if (activeRestrictions) { risk += 10; riskFactors.push(`${activeRestrictions} active restriction${activeRestrictions === 1 ? "" : "s"}`); }
  if (!riskFactors.length) riskFactors.push("No risk signals");
  risk = Math.min(100, risk);

  // ---- username history (every nickname ever, newest first) ----
  const unameRows = (unameRes.data ?? []) as { old_username: string | null; new_username: string; changed_at: string }[];
  const usernameHistory = unameRows.map((u) => ({ old: u.old_username, current: u.new_username, at: u.changed_at }));

  // ---- moderation / violation history ----
  const violations = ((violRes.data ?? []) as { id: string; subject_type: string; category: string; severity: number; detail: string; evidence: string | null; action: string; action_label: string; action_until: string | null; created_at: string }[])
    .map((v) => ({ id: v.id, subjectType: v.subject_type, category: v.category, severity: v.severity, detail: v.detail, evidence: v.evidence, action: v.action, actionLabel: v.action_label, actionUntil: v.action_until, createdAt: v.created_at }));

  // ---- raw profile column dump (every field, nothing hidden) ----
  const raw = Object.entries(prof as Record<string, unknown>)
    .map(([key, value]) => ({ key, value: value === null || value === undefined ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value) }))
    .sort((a, b) => a.key.localeCompare(b.key));

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

  const authUser = authRes.data?.user as {
    last_sign_in_at?: string | null; email_confirmed_at?: string | null; created_at?: string | null;
    email?: string | null; phone?: string | null; phone_confirmed_at?: string | null;
    app_metadata?: { provider?: string; providers?: string[]; role?: string };
  } | undefined;
  const providers = authUser?.app_metadata?.providers ?? (authUser?.app_metadata?.provider ? [authUser.app_metadata.provider] : []);

  return {
    profile: {
      id: prof.id, username: prof.username, fullName: prof.full_name ?? "", avatarUrl: prof.avatar_url, bannerUrl: prof.banner_url, bio: prof.bio ?? "",
      role: prof.role, plan: prof.plan ?? "free", isVerified: !!prof.is_verified, loyaltyTier: prof.loyalty_tier ?? "Bronze",
      loyaltyPoints: prof.loyalty_points ?? 0, cashbackBalance: Number(prof.cashback_balance ?? 0),
      email: prof.email, phone: prof.phone, showPhone: !!prof.show_phone, socials: (prof.socials ?? {}) as Record<string, string>,
      links: Array.isArray(prof.links) ? (prof.links as { label: string; url: string }[]) : [],
      telegramChatId: prof.telegram_chat_id ?? null, locale: prof.locale, theme: prof.theme,
      birthday: prof.birthday, createdAt: prof.created_at, isAdmin: prof.role === "admin", isOwner: isOwnerEmail(prof.email),
      isBanned: !!prof.is_banned, bannedAt: prof.banned_at ?? null, banReason: prof.ban_reason ?? null, banUntil: prof.ban_until ?? null,
      restrictions: (prof.restrictions ?? {}) as Record<string, string>,
      adminNote: prof.admin_note ?? "",
    },
    auth: {
      lastSignIn: authUser?.last_sign_in_at ?? null, emailConfirmed: !!authUser?.email_confirmed_at, authCreatedAt: authUser?.created_at ?? null,
      authEmail: authUser?.email ?? null, authPhone: authUser?.phone ?? null, phoneConfirmed: !!authUser?.phone_confirmed_at,
      providers, metaRole: authUser?.app_metadata?.role ?? null,
    },
    buyer: {
      spent: Math.round(spent), orders: buy.length, avgOrder: nonCancelled ? Math.round(spent / nonCancelled) : 0,
      cancelled, cancelRate, repeatRate,
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
    personal,
    cart,
    favorites,
    moderation: { blocking, blockedBy, reportsFiled, reportsAgainst, riskScore: risk, riskFactors },
    usernameHistory,
    violations,
    raw,
    timeline,
  };
}
