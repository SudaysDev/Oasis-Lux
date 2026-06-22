import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");
export type Point = { label: string; value: number };

export type PromoStatus = "active" | "scheduled" | "expired" | "maxed" | "disabled";

function statusOf(p: { is_active: boolean; expires_at: string | null; usage_limit: number | null; used_count: number }): PromoStatus {
  if (!p.is_active) return "disabled";
  if (p.expires_at && new Date(p.expires_at) < new Date()) return "expired";
  if (p.usage_limit != null && p.used_count >= p.usage_limit) return "maxed";
  return "active";
}

export type AdminPromoRow = {
  id: string; code: string; type: string; value: number; scope: string; scopeRef: string | null; scopeLabel: string | null;
  minOrder: number | null; maxDiscount: number | null; expiresAt: string | null; usageLimit: number | null;
  usedCount: number; isActive: boolean; aiGenerated: boolean; createdAt: string;
  redemptions: number; orders: number; discountGiven: number; status: PromoStatus;
};

export type AdminPromoList = {
  summary: { total: number; active: number; expired: number; disabled: number; redemptions: number; orders: number; discountGiven: number; cashback: number };
  promos: AdminPromoRow[];
};

export async function getAdminPromoList(): Promise<AdminPromoList> {
  const sb = createAdminClient();
  const [promoRes, redRes, orderRes] = await Promise.all([
    sb.from("promo_codes").select("*").order("created_at", { ascending: false }).limit(2000),
    sb.from("promo_redemptions").select("promo_id").limit(20000),
    sb.from("orders").select("promo_code,discount,status").not("promo_code", "is", null).limit(20000),
  ]);
  const promos = (promoRes.data ?? []) as Record<string, unknown>[];
  const reds = (redRes.data ?? []) as { promo_id: string }[];
  const orders = (orderRes.data ?? []) as { promo_code: string | null; discount: number | string; status: string }[];

  const redByPromo = new Map<string, number>();
  for (const r of reds) redByPromo.set(r.promo_id, (redByPromo.get(r.promo_id) ?? 0) + 1);
  const ordByCode = new Map<string, { n: number; disc: number }>();
  for (const o of orders) {
    if (!o.promo_code || o.status === "cancelled") continue;
    const k = o.promo_code.toUpperCase();
    const e = ordByCode.get(k) ?? { n: 0, disc: 0 };
    e.n += 1; e.disc += Number(o.discount ?? 0);
    ordByCode.set(k, e);
  }

  const rows: AdminPromoRow[] = promos.map((p) => {
    const code = String(p.code);
    const ord = ordByCode.get(code.toUpperCase()) ?? { n: 0, disc: 0 };
    const base = {
      is_active: !!p.is_active, expires_at: (p.expires_at as string | null) ?? null,
      usage_limit: (p.usage_limit as number | null) ?? null, used_count: Number(p.used_count ?? 0),
    };
    return {
      id: String(p.id), code, type: String(p.type), value: Number(p.value), scope: String(p.scope),
      scopeRef: (p.scope_ref as string | null) ?? null, scopeLabel: (p.scope_label as string | null) ?? null,
      minOrder: (p.min_order as number | null) ?? null, maxDiscount: (p.max_discount as number | null) ?? null,
      expiresAt: base.expires_at, usageLimit: base.usage_limit, usedCount: base.used_count,
      isActive: base.is_active, aiGenerated: !!p.ai_generated, createdAt: String(p.created_at),
      redemptions: redByPromo.get(String(p.id)) ?? 0, orders: ord.n, discountGiven: Math.round(ord.disc),
      status: statusOf(base),
    };
  });

  const summary = {
    total: rows.length,
    active: rows.filter((r) => r.status === "active").length,
    expired: rows.filter((r) => r.status === "expired").length,
    disabled: rows.filter((r) => r.status === "disabled").length,
    redemptions: rows.reduce((s, r) => s + r.redemptions, 0),
    orders: rows.reduce((s, r) => s + r.orders, 0),
    discountGiven: rows.reduce((s, r) => s + r.discountGiven, 0),
    cashback: rows.filter((r) => r.type === "cashback").length,
  };
  return { summary, promos: rows };
}

/* ===================================================================== */
/* PROMO DOSSIER                                                          */
/* ===================================================================== */
export type AdminPromoDossier = {
  promo: AdminPromoRow & { currency: string };
  stats: { redemptions: number; orders: number; uniqueUsers: number; discountGiven: number; avgDiscount: number; remaining: number | null; daysLeft: number | null };
  redeem30d: Point[];
  byContext: { context: string; count: number }[];
  recent: { id: string; user: string; userId: string | null; context: string; created_at: string }[];
  topRedeemers: { id: string; username: string; count: number }[];
  ordersList: { id: string; buyer: string; total: number; discount: number; status: string; created_at: string }[];
  taxonomy: { brands: string[]; categories: { slug: string; label: string }[] };
};

export async function getAdminPromoDossier(id: string): Promise<AdminPromoDossier | null> {
  const sb = createAdminClient();
  const { data: p } = await sb.from("promo_codes").select("*").eq("id", id).maybeSingle();
  if (!p) return null;
  const code = String(p.code);

  const [redRes, ordRes, brandsRes, catsRes] = await Promise.all([
    sb.from("promo_redemptions").select("id,user_id,context,created_at").eq("promo_id", id).order("created_at", { ascending: false }).limit(5000),
    sb.from("orders").select("id,user_id,total,discount,status,created_at").ilike("promo_code", code).order("created_at", { ascending: false }).limit(5000),
    sb.from("brands").select("name").order("name"),
    sb.from("categories").select("id,name,slug,parent_id").order("sort"),
  ]);
  const reds = (redRes.data ?? []) as { id: string; user_id: string; context: string; created_at: string }[];
  const ords = (ordRes.data ?? []) as { id: string; user_id: string; total: number; discount: number; status: string; created_at: string }[];

  // resolve usernames (redeemers + buyers)
  const ids = [...new Set([...reds.map((r) => r.user_id), ...ords.map((o) => o.user_id)])].filter(Boolean);
  const nameMap = new Map<string, string>();
  if (ids.length) {
    const { data } = await sb.from("profiles").select("id,username").in("id", ids);
    for (const u of (data ?? []) as { id: string; username: string }[]) nameMap.set(u.id, u.username);
  }

  const now = Date.now();
  const redeem30d: Point[] = [];
  for (let i = 29; i >= 0; i--) { const d = new Date(now - i * DAY); redeem30d.push({ label: `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`, value: 0 }); }
  const byContext = new Map<string, number>();
  const perUser = new Map<string, number>();
  for (const r of reds) {
    byContext.set(r.context, (byContext.get(r.context) ?? 0) + 1);
    if (r.user_id) perUser.set(r.user_id, (perUser.get(r.user_id) ?? 0) + 1);
    const idx = 29 - Math.floor((now - new Date(r.created_at).getTime()) / DAY);
    if (idx >= 0 && idx < 30) redeem30d[idx].value += 1;
  }
  // fold checkout orders into the 30-day series + contexts too
  let discountGiven = 0;
  for (const o of ords) {
    if (o.status === "cancelled") continue;
    discountGiven += Number(o.discount ?? 0);
    if (o.user_id) perUser.set(o.user_id, (perUser.get(o.user_id) ?? 0) + 1);
    const idx = 29 - Math.floor((now - new Date(o.created_at).getTime()) / DAY);
    if (idx >= 0 && idx < 30) redeem30d[idx].value += 1;
  }
  if (ords.length) byContext.set("checkout", (byContext.get("checkout") ?? 0) + ords.filter((o) => o.status !== "cancelled").length);

  const usedCount = Number(p.used_count ?? 0);
  const usageLimit = (p.usage_limit as number | null) ?? null;
  const expiresAt = (p.expires_at as string | null) ?? null;
  const base = { is_active: !!p.is_active, expires_at: expiresAt, usage_limit: usageLimit, used_count: usedCount };

  const cats = (catsRes.data ?? []) as { id: string; name: string; slug: string; parent_id: string | null }[];
  const nameById = new Map(cats.map((c) => [c.id, c.name] as const));

  return {
    promo: {
      id: String(p.id), code, type: String(p.type), value: Number(p.value), scope: String(p.scope),
      scopeRef: (p.scope_ref as string | null) ?? null, scopeLabel: (p.scope_label as string | null) ?? null,
      minOrder: (p.min_order as number | null) ?? null, maxDiscount: (p.max_discount as number | null) ?? null,
      expiresAt, usageLimit, usedCount, isActive: !!p.is_active, aiGenerated: !!p.ai_generated, createdAt: String(p.created_at),
      redemptions: reds.length, orders: ords.filter((o) => o.status !== "cancelled").length, discountGiven: Math.round(discountGiven),
      status: statusOf(base), currency: "TJS",
    },
    stats: {
      redemptions: reds.length, orders: ords.filter((o) => o.status !== "cancelled").length, uniqueUsers: perUser.size,
      discountGiven: Math.round(discountGiven), avgDiscount: ords.length ? Math.round(discountGiven / ords.filter((o) => o.status !== "cancelled").length || 0) : 0,
      remaining: usageLimit != null ? Math.max(0, usageLimit - usedCount) : null,
      daysLeft: expiresAt ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / DAY)) : null,
    },
    redeem30d,
    byContext: [...byContext.entries()].map(([context, count]) => ({ context, count })).sort((a, b) => b.count - a.count),
    recent: reds.slice(0, 12).map((r) => ({ id: r.id, user: nameMap.get(r.user_id) ?? "user", userId: r.user_id ?? null, context: r.context, created_at: r.created_at })),
    topRedeemers: [...perUser.entries()].map(([uid, count]) => ({ id: uid, username: nameMap.get(uid) ?? "user", count })).sort((a, b) => b.count - a.count).slice(0, 8),
    ordersList: ords.slice(0, 12).map((o) => ({ id: o.id, buyer: nameMap.get(o.user_id) ?? "user", total: Number(o.total), discount: Number(o.discount), status: o.status, created_at: o.created_at })),
    taxonomy: {
      brands: (brandsRes.data ?? []).map((b: { name: string }) => b.name),
      categories: cats.map((c) => ({ slug: c.slug, label: c.parent_id ? `${nameById.get(c.parent_id) ?? "—"} › ${c.name}` : c.name })).sort((a, b) => a.label.localeCompare(b.label)),
    },
  };
}
