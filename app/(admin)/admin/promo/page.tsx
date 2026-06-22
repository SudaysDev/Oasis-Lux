import type { Metadata } from "next";
import { getAdminPromoList } from "@/lib/data/admin-promo";
import { createAdminClient } from "@/lib/supabase/admin";
import { PromoClient } from "@/components/admin/PromoClient";

export const metadata: Metadata = { title: "Promo Engine · Admin" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const sb = createAdminClient();
  const [data, brandsRes, catsRes] = await Promise.all([
    getAdminPromoList(),
    sb.from("brands").select("name").order("name"),
    sb.from("categories").select("id,name,slug,parent_id").order("sort"),
  ]);
  const cats = (catsRes.data ?? []) as { id: string; name: string; slug: string; parent_id: string | null }[];
  const nameById = new Map(cats.map((c) => [c.id, c.name] as const));
  const categories = cats
    .map((c) => ({ slug: c.slug, label: c.parent_id ? `${nameById.get(c.parent_id) ?? "—"} › ${c.name}` : c.name }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const brands = (brandsRes.data ?? []).map((b: { name: string }) => b.name);

  return <PromoClient data={data} brands={brands} categories={categories} />;
}
