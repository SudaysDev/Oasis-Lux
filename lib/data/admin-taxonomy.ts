import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type CatLeaf = { id: string; name: string; slug: string; icon: string; sort: number; count: number };
export type CatNode = CatLeaf & { children: CatLeaf[] };
export type AdminTaxonomy = {
  categories: CatNode[];
  brands: { id: string; name: string; count: number }[];
  colors: { id: string; name: string; hex: string; count: number }[];
  tags: { id: string; name: string; count: number }[];
  counts: { sections: number; subsections: number; brands: number; colors: number; tags: number };
};

export async function getAdminTaxonomy(): Promise<AdminTaxonomy> {
  const sb = createAdminClient();
  const [catRes, brandRes, colorRes, tagRes, prodRes] = await Promise.all([
    sb.from("categories").select("id,name,slug,icon,sort,parent_id").order("sort", { ascending: true }),
    sb.from("brands").select("id,name").order("name", { ascending: true }),
    sb.from("colors").select("id,name,hex").order("created_at", { ascending: true }),
    sb.from("tags").select("id,name").order("name", { ascending: true }),
    sb.from("products").select("category,brand,color,tags").limit(8000),
  ]);

  const cats = (catRes.data ?? []) as { id: string; name: string; slug: string; icon: string; sort: number; parent_id: string | null }[];
  const products = (prodRes.data ?? []) as { category: string | null; brand: string | null; color: string | null; tags: string[] | null }[];

  const catCount = new Map<string, number>();
  const brandCount = new Map<string, number>();
  const colorCount = new Map<string, number>();
  const tagCount = new Map<string, number>();
  for (const p of products) {
    if (p.category) catCount.set(p.category, (catCount.get(p.category) ?? 0) + 1);
    if (p.brand?.trim()) brandCount.set(p.brand.toLowerCase(), (brandCount.get(p.brand.toLowerCase()) ?? 0) + 1);
    if (p.color?.trim()) colorCount.set(p.color.toLowerCase(), (colorCount.get(p.color.toLowerCase()) ?? 0) + 1);
    for (const t of p.tags ?? []) tagCount.set(t.toLowerCase(), (tagCount.get(t.toLowerCase()) ?? 0) + 1);
  }

  const leaf = (c: (typeof cats)[number]): CatLeaf => ({ id: c.id, name: c.name, slug: c.slug, icon: c.icon, sort: c.sort, count: catCount.get(c.slug) ?? 0 });
  const tops = cats.filter((c) => !c.parent_id);
  const categories: CatNode[] = tops.map((t) => ({
    ...leaf(t),
    children: cats.filter((c) => c.parent_id === t.id).sort((a, b) => a.sort - b.sort).map(leaf),
  }));

  const brands = (brandRes.data ?? []).map((b: { id: string; name: string }) => ({ id: b.id, name: b.name, count: brandCount.get(b.name.toLowerCase()) ?? 0 }));
  const colors = (colorRes.data ?? []).map((c: { id: string; name: string; hex: string }) => ({ id: c.id, name: c.name, hex: c.hex, count: colorCount.get(c.name.toLowerCase()) ?? 0 }));
  const tags = (tagRes.data ?? []).map((t: { id: string; name: string }) => ({ id: t.id, name: t.name, count: tagCount.get(t.name.toLowerCase()) ?? 0 }));

  return {
    categories,
    brands,
    colors,
    tags,
    counts: { sections: tops.length, subsections: cats.length - tops.length, brands: brands.length, colors: colors.length, tags: tags.length },
  };
}
