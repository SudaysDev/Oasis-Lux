import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type ProductRow = {
  id: string;
  title: string;
  brand: string;
  type: string;
  category: string | null;
  condition: string;
  price: number;
  currency: string;
  stock: number;
  rating: number;
  isActive: boolean;
  image: string | null;
  createdAt: string;
  sellerId: string;
  seller: string;
  tags: string[];
};

export type AdminInventory = {
  summary: {
    total: number; active: number; inactive: number; totalStock: number; outOfStock: number; lowStock: number;
    totalValue: number; avgPrice: number; avgRating: number; brands: number; categories: number;
  };
  byType: { label: string; value: number }[];
  facets: { types: string[]; categories: string[]; brands: string[]; conditions: string[] };
  products: ProductRow[];
};

export async function getAdminInventory(): Promise<AdminInventory> {
  const sb = createAdminClient();
  const [prodRes, profRes] = await Promise.all([
    sb.from("products").select("id,title,brand,type,category,condition,price,currency,stock,rating,is_active,images,tags,created_at,seller_id").order("created_at", { ascending: false }).limit(8000),
    sb.from("profiles").select("id,username").limit(5000),
  ]);
  const rows = (prodRes.data ?? []) as {
    id: string; title: string; brand: string; type: string; category: string | null; condition: string;
    price: number; currency: string; stock: number; rating: number; is_active: boolean; images: string[] | null;
    tags: string[] | null; created_at: string; seller_id: string;
  }[];
  const nameOf = new Map(((profRes.data ?? []) as { id: string; username: string }[]).map((p) => [p.id, p.username] as const));

  const products: ProductRow[] = rows.map((p) => ({
    id: p.id,
    title: p.title,
    brand: p.brand?.trim() || "—",
    type: p.type,
    category: p.category,
    condition: p.condition,
    price: Number(p.price),
    currency: p.currency,
    stock: p.stock,
    rating: Number(p.rating),
    isActive: p.is_active,
    image: p.images?.[0] ?? null,
    createdAt: p.created_at,
    sellerId: p.seller_id,
    seller: nameOf.get(p.seller_id) ?? "unknown",
    tags: p.tags ?? [],
  }));

  const active = products.filter((p) => p.isActive);
  const totalStock = active.reduce((s, p) => s + p.stock, 0);
  const totalValue = active.reduce((s, p) => s + p.stock * p.price, 0);
  const ratings = products.filter((p) => p.rating > 0);
  const byTypeMap = new Map<string, number>();
  for (const p of products) byTypeMap.set(p.type, (byTypeMap.get(p.type) ?? 0) + 1);

  const types = [...new Set(products.map((p) => p.type))].sort();
  const categories = [...new Set(products.map((p) => p.category).filter((c): c is string => !!c))].sort();
  const brands = [...new Set(products.map((p) => p.brand).filter((b) => b && b !== "—"))].sort();
  const conditions = [...new Set(products.map((p) => p.condition))].sort();

  return {
    summary: {
      total: products.length,
      active: active.length,
      inactive: products.length - active.length,
      totalStock,
      outOfStock: active.filter((p) => p.stock === 0).length,
      lowStock: active.filter((p) => p.stock > 0 && p.stock <= 3).length,
      totalValue: Math.round(totalValue),
      avgPrice: products.length ? Math.round(products.reduce((s, p) => s + p.price, 0) / products.length) : 0,
      avgRating: ratings.length ? Math.round((ratings.reduce((s, p) => s + p.rating, 0) / ratings.length) * 10) / 10 : 0,
      brands: brands.length,
      categories: categories.length,
    },
    byType: [...byTypeMap.entries()].map(([label, value]) => ({ label: label.charAt(0).toUpperCase() + label.slice(1), value })),
    facets: { types, categories, brands, conditions },
    products,
  };
}
