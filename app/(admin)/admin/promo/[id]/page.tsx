import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAdminPromoDossier } from "@/lib/data/admin-promo";
import { PromoDossierClient } from "@/components/admin/PromoDossierClient";

export const metadata: Metadata = { title: "Promo · Admin" };
export const dynamic = "force-dynamic";

export default async function PromoDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dossier = await getAdminPromoDossier(id);

  if (!dossier) {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center">
        <p className="font-mono text-sm uppercase tracking-[0.3em] text-white/40">Promo not found</p>
        <h1 className="mt-2 text-2xl font-black text-white">No such promo code</h1>
        <Link href="/admin/promo" className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/80 transition hover:bg-white/5">
          <ArrowLeft className="h-4 w-4" /> Back to promo codes
        </Link>
      </div>
    );
  }
  return <PromoDossierClient d={dossier} />;
}
