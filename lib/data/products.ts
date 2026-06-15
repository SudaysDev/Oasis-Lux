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

/** All active listings, newest first. */
export async function fetchActiveProducts(sb: SupabaseClient, limit = 120): Promise<DemoProduct[]> {
  const { data } = await sb
    .from("products")
    .select("id,title,brand,type,price,stock,hue,rating,images,description,tags,color,size,condition,created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Row[]).map(mapRow);
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
