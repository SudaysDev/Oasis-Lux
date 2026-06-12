import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { DashboardShell } from "@/components/app/DashboardShell";
import { CatalogView } from "@/components/shop/CatalogView";

export const metadata: Metadata = { title: "Catalog" };

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string }> }) {
  const profile = await requireUser();
  const sp = await searchParams;
  const q = sp.q ?? "";
  const cat = sp.cat ?? "";
  return (
    <DashboardShell profile={profile}>
      <Suspense fallback={null}>
        <CatalogView key={`${q}|${cat}`} initialQ={q} initialCat={cat || null} />
      </Suspense>
    </DashboardShell>
  );
}
