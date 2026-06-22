import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/* ===================================================================== */
/* BLACK LIST — every ban, restriction, scoped block, product sanction,   */
/* violation and open report on one screen.                               */
/* ===================================================================== */

const now = () => Date.now();
const sancActive = (v: string | undefined): boolean => !!v && (v === "perm" || new Date(v).getTime() > now());

export type SancEntry = { kind: string; until: string | null; perm: boolean };
export type BannedUser = { id: string; username: string; avatarUrl: string | null; reason: string | null; bannedAt: string | null; until: string | null; perm: boolean };
export type RestrictedUser = { id: string; username: string; avatarUrl: string | null; kinds: SancEntry[] };
export type PurchaseBlock = { id: string; userId: string; username: string; avatarUrl: string | null; scopeType: string; scopeValue: string; until: string | null; perm: boolean; createdAt: string };
export type SanctionedProduct = { id: string; title: string; brand: string; image: string | null; sellerId: string; sellerName: string; flags: SancEntry[] };
export type ViolationRow = { id: string; offenderId: string | null; offender: string; subjectType: string; subjectId: string; subjectLabel: string; category: string; severity: number; detail: string; action: string; actionLabel: string; actionUntil: string | null; createdAt: string };
export type ReportRow = { id: string; reportedId: string; reported: string; reporterId: string; reporter: string; category: string; description: string; status: string; createdAt: string };

export type AdminBans = {
  summary: { banned: number; timedBans: number; restricted: number; restrictions: number; blocks: number; products: number; violations: number; openReports: number };
  banned: BannedUser[];
  restricted: RestrictedUser[];
  blocks: PurchaseBlock[];
  products: SanctionedProduct[];
  violations: ViolationRow[];
  reports: ReportRow[];
};

const RESTRICT_KINDS = ["chat", "sell", "buy", "review", "report", "favorite", "cart"];
const PRODUCT_FLAGS = ["hidden", "frozen", "no_reviews", "no_orders"];

export async function getAdminBans(): Promise<AdminBans> {
  const sb = createAdminClient();
  const [profRes, blocksRes, prodRes, violRes, repRes] = await Promise.all([
    sb.from("profiles").select("id,username,avatar_url,is_banned,ban_until,ban_reason,banned_at,restrictions").limit(10000),
    sb.from("purchase_blocks").select("id,user_id,scope_type,scope_value,until,created_at").order("created_at", { ascending: false }).limit(2000),
    sb.from("products").select("id,title,brand,images,seller_id,sanctions").limit(20000),
    sb.from("violations").select("id,user_id,subject_type,subject_id,category,severity,detail,action,action_label,action_until,created_at").order("created_at", { ascending: false }).limit(120),
    sb.from("reports").select("id,reported_id,reporter_id,category,description,status,created_at").in("status", ["open", "reviewing"]).order("created_at", { ascending: false }).limit(120),
  ]);

  const profiles = (profRes.data ?? []) as { id: string; username: string; avatar_url: string | null; is_banned: boolean; ban_until: string | null; ban_reason: string | null; banned_at: string | null; restrictions: Record<string, string> | null }[];
  const nameMap = new Map(profiles.map((p) => [p.id, p.username] as const));
  const avatarMap = new Map(profiles.map((p) => [p.id, p.avatar_url] as const));

  // banned (permanent OR live timed)
  const banned: BannedUser[] = profiles
    .filter((p) => p.is_banned || (p.ban_until && new Date(p.ban_until).getTime() > now()))
    .map((p) => ({ id: p.id, username: p.username, avatarUrl: p.avatar_url, reason: p.ban_reason, bannedAt: p.banned_at, until: p.ban_until, perm: p.is_banned && !p.ban_until }))
    .sort((a, b) => +new Date(b.bannedAt ?? 0) - +new Date(a.bannedAt ?? 0));

  // restricted (any active restriction kind)
  const restricted: RestrictedUser[] = profiles
    .map((p) => {
      const map = (p.restrictions ?? {}) as Record<string, string>;
      const kinds: SancEntry[] = RESTRICT_KINDS.filter((k) => sancActive(map[k])).map((k) => ({ kind: k, until: map[k] === "perm" ? null : map[k], perm: map[k] === "perm" }));
      return kinds.length ? { id: p.id, username: p.username, avatarUrl: p.avatar_url, kinds } : null;
    })
    .filter(Boolean) as RestrictedUser[];

  // scoped purchase blocks
  const blocksRaw = (blocksRes.data ?? []) as { id: string; user_id: string; scope_type: string; scope_value: string; until: string | null; created_at: string }[];
  const blocks: PurchaseBlock[] = blocksRaw
    .filter((b) => !b.until || new Date(b.until).getTime() > now())
    .map((b) => ({ id: b.id, userId: b.user_id, username: nameMap.get(b.user_id) ?? "user", avatarUrl: avatarMap.get(b.user_id) ?? null, scopeType: b.scope_type, scopeValue: b.scope_value, until: b.until, perm: !b.until, createdAt: b.created_at }));

  // sanctioned products (negative flags only)
  const prodRows = (prodRes.data ?? []) as { id: string; title: string; brand: string; images: string[] | null; seller_id: string; sanctions: Record<string, string> | null }[];
  const products: SanctionedProduct[] = prodRows
    .map((p) => {
      const map = (p.sanctions ?? {}) as Record<string, string>;
      const flags: SancEntry[] = PRODUCT_FLAGS.filter((f) => sancActive(map[f])).map((f) => ({ kind: f, until: map[f] === "perm" ? null : map[f], perm: map[f] === "perm" }));
      return flags.length ? { id: p.id, title: p.title, brand: p.brand, image: p.images?.[0] ?? null, sellerId: p.seller_id, sellerName: nameMap.get(p.seller_id) ?? "seller", flags } : null;
    })
    .filter(Boolean) as SanctionedProduct[];

  // violations — resolve product subject titles
  const violRaw = (violRes.data ?? []) as { id: string; user_id: string | null; subject_type: string; subject_id: string; category: string; severity: number; detail: string; action: string; action_label: string; action_until: string | null; created_at: string }[];
  const prodSubjectIds = [...new Set(violRaw.filter((v) => v.subject_type === "product").map((v) => v.subject_id))];
  const prodTitle = new Map<string, string>();
  if (prodSubjectIds.length) {
    const { data } = await sb.from("products").select("id,title").in("id", prodSubjectIds);
    for (const r of (data ?? []) as { id: string; title: string }[]) prodTitle.set(r.id, r.title);
  }
  const violations: ViolationRow[] = violRaw.map((v) => ({
    id: v.id, offenderId: v.user_id, offender: v.user_id ? nameMap.get(v.user_id) ?? "user" : "—",
    subjectType: v.subject_type, subjectId: v.subject_id,
    subjectLabel: v.subject_type === "product" ? (prodTitle.get(v.subject_id) ?? "product") : (nameMap.get(v.subject_id) ?? "user"),
    category: v.category, severity: v.severity, detail: v.detail, action: v.action, actionLabel: v.action_label, actionUntil: v.action_until, createdAt: v.created_at,
  }));

  // open reports
  const repRaw = (repRes.data ?? []) as { id: string; reported_id: string; reporter_id: string; category: string; description: string; status: string; created_at: string }[];
  const reports: ReportRow[] = repRaw.map((r) => ({
    id: r.id, reportedId: r.reported_id, reported: nameMap.get(r.reported_id) ?? "user", reporterId: r.reporter_id, reporter: nameMap.get(r.reporter_id) ?? "user",
    category: r.category, description: r.description, status: r.status, createdAt: r.created_at,
  }));

  return {
    summary: {
      banned: banned.length,
      timedBans: banned.filter((b) => !b.perm).length,
      restricted: restricted.length,
      restrictions: restricted.reduce((s, r) => s + r.kinds.length, 0),
      blocks: blocks.length,
      products: products.length,
      violations: violations.length,
      openReports: reports.length,
    },
    banned, restricted, blocks, products, violations, reports,
  };
}
