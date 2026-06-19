import type { Metadata } from "next";
import { getAdminTaxonomy } from "@/lib/data/admin-taxonomy";
import { TaxonomyClient } from "@/components/admin/TaxonomyClient";

export const metadata: Metadata = { title: "Taxonomy · Admin" };
export const dynamic = "force-dynamic";

export default async function TaxonomyPage() {
  const data = await getAdminTaxonomy();
  return <TaxonomyClient data={data} />;
}
