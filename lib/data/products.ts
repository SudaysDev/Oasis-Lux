// Live catalog products (real seller listings from the `products` table),
// mapped to the DemoProduct card shape so they render anywhere demo cards do.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DemoProduct } from "@/lib/landing-data";
import type { ProductType } from "@/types";

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
