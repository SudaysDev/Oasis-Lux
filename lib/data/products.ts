// Live catalog products (real seller listings from the `products` table),
// mapped to the DemoProduct card shape so they render anywhere demo cards do.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DemoProduct } from "@/lib/landing-data";
import type { MiniProfile, Plan, ProductType } from "@/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Row {
  id: string;
  title: string;
  brand: string | null;
  type: ProductType;
  price: number | string;
  stock: number;
  hue: number;
  rating: number | string;
  images: string[] | null;
  description: string | null;
  tags: string[] | null;
  color: string | null;
  size: string | null;
  condition: "new" | "like_new" | "used" | null;
  created_at: string;
}

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

function mapRow(r: Row): DemoProduct {
  return {
    id: r.id,
    title: r.title,
    brand: r.brand || "—",
    type: r.type,
    price: Number(r.price) || 0,
    rating: Number(r.rating) || 0,
    hue: r.hue ?? 200,
    stock: r.stock ?? 0,
    desc: r.description ? stripHtml(r.description).slice(0, 160) : undefined,
    image: r.images?.[0],
    tags: r.tags ?? [],
    colors: r.color ? r.color.split(",").map((c) => c.trim()).filter(Boolean) : [],
    size: r.size ?? undefined,
    condition: r.condition ?? "new",
    createdAt: r.created_at,
    isLive: true,
  };
}

/** True when a jsonb sanction/flag map has `key` active (= 'perm' or a future ISO date). */
function sancActive(map: Record<string, string> | null | undefined, key: string): boolean {
  const v = map?.[key];
  if (!v) return false;
  return v === "perm" || new Date(v).getTime() > Date.now();
}

/** All active listings — PROMOTED first (featured products + boosted sellers), then newest.
 *  This is how `/promote <id>` and `/boost @seller` surface more often in the feed. */
export async function fetchActiveProducts(sb: SupabaseClient, limit = 120): Promise<DemoProduct[]> {
  const { data } = await sb
    .from("products")
    .select("id,title,brand,type,price,stock,hue,rating,images,description,tags,color,size,condition,created_at,seller_id,sanctions")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  type Raw = Row & { seller_id: string; sanctions: Record<string, string> | null };
  const rows = (data ?? []) as Raw[];

  // which sellers are currently boosted (small set — boosted is rare)
  const boosted = new Set<string>();
  const { data: bs } = await sb.from("profiles").select("id").eq("is_boosted", true);
  for (const r of (bs ?? []) as { id: string }[]) boosted.add(r.id);

  // rank: featured product (2) > boosted seller (1) > normal (0); stable within rank keeps newest-first
  const rank = (r: Raw) => (sancActive(r.sanctions, "featured") ? 2 : boosted.has(r.seller_id) ? 1 : 0);
  const ordered = rows.map((r, i) => ({ r, i })).sort((a, b) => rank(b.r) - rank(a.r) || a.i - b.i);
  return ordered.map(({ r }) => mapRow(r));
}

// ---------------------------------------------------------------------------
// Single product detail (Product-by-ID page)
// ---------------------------------------------------------------------------

/** A DemoProduct enriched with the fields the detail page needs (all photos,
 *  full description HTML, seller, category). Live rows carry these; demo seeds
 *  fall back to their card shape. */
export interface ProductDetail extends DemoProduct {
  images: string[];
  descriptionHtml?: string;
  sellerId?: string;
  category?: string;
}

interface DetailRow extends Row {
  seller_id: string;
  category: string | null;
}

/** Fetch one live listing by id, or null when the id is not a DB uuid / not found. */
export async function fetchProductDetail(sb: SupabaseClient, id: string): Promise<ProductDetail | null> {
  if (!UUID_RE.test(id)) return null;
  const { data } = await sb
    .from("products")
    .select(
      "id,title,brand,type,price,stock,hue,rating,images,description,tags,color,size,condition,created_at,seller_id,category",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const r = data as DetailRow;
  const base = mapRow(r);
  return {
    ...base,
    images: r.images ?? [],
    descriptionHtml: r.description ?? undefined,
    sellerId: r.seller_id,
    category: r.category ?? undefined,
  };
}

interface MiniRow {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  plan: Plan | null;
  is_verified: boolean | null;
}

/** Map of live productId → seller_id (demo seed ids are skipped). */
export async function fetchProductSellers(sb: SupabaseClient, ids: string[]): Promise<Record<string, string>> {
  const live = ids.filter((id) => UUID_RE.test(id));
  if (live.length === 0) return {};
  const { data } = await sb.from("products").select("id,seller_id").in("id", live);
  const out: Record<string, string> = {};
  for (const r of (data ?? []) as { id: string; seller_id: string }[]) out[r.id] = r.seller_id;
  return out;
}

export interface SellerCard extends MiniProfile {
  itemCount: number;
  avgRating: number;
}

/**
 * Top sellers for the home "boutiques" rail — derived from active listings:
 * group by seller, count items and average their ratings. Best-effort (returns
 * [] on any error) so the UI can blend in curated fallbacks.
 */
export async function fetchTopSellers(sb: SupabaseClient, limit = 12): Promise<SellerCard[]> {
  try {
    const { data } = await sb
      .from("products")
      .select("seller_id, rating")
      .eq("is_active", true)
      .limit(400);
    const rows = (data ?? []) as { seller_id: string | null; rating: number | string }[];

    const agg = new Map<string, { count: number; sum: number }>();
    for (const r of rows) {
      if (!r.seller_id || !UUID_RE.test(r.seller_id)) continue;
      const a = agg.get(r.seller_id) ?? { count: 0, sum: 0 };
      a.count += 1;
      a.sum += Number(r.rating) || 0;
      agg.set(r.seller_id, a);
    }
    const top = [...agg.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, limit);
    if (top.length === 0) return [];

    const { data: profs } = await sb
      .from("profiles")
      .select("id, username, full_name, avatar_url, plan, is_verified")
      .in("id", top.map(([id]) => id));
    const byId = new Map(((profs ?? []) as MiniRow[]).map((p) => [p.id, p] as const));

    const out: SellerCard[] = [];
    for (const [id, a] of top) {
      const p = byId.get(id);
      if (!p) continue;
      out.push({
        id: p.id,
        username: p.username,
        fullName: p.full_name ?? "",
        avatarUrl: p.avatar_url ?? undefined,
        plan: p.plan ?? "free",
        isVerified: p.is_verified ?? false,
        itemCount: a.count,
        avgRating: a.count ? a.sum / a.count : 0,
      });
    }
    return out;
  } catch {
    return [];
  }
}

/** Minimal seller identity for the "sold by" card. */
export async function fetchSellerMini(sb: SupabaseClient, id: string): Promise<MiniProfile | null> {
  if (!UUID_RE.test(id)) return null;
  const { data } = await sb
    .from("profiles")
    .select("id, username, full_name, avatar_url, plan, is_verified")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const r = data as MiniRow;
  return {
    id: r.id,
    username: r.username,
    fullName: r.full_name ?? "",
    avatarUrl: r.avatar_url ?? undefined,
    plan: r.plan ?? "free",
    isVerified: r.is_verified ?? false,
  };
}
