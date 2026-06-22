import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAdminOrderDossier } from "@/lib/data/admin-orders";
import { OrderDossierClient } from "@/components/admin/OrderDossierClient";

export const metadata: Metadata = { title: "Order · Admin" };
export const dynamic = "force-dynamic";

export default async function OrderDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dossier = await getAdminOrderDossier(id);

  if (!dossier) {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center">
        <p className="font-mono text-sm uppercase tracking-[0.3em] text-white/40">Order not found</p>
        <h1 className="mt-2 text-2xl font-black text-white">No such order</h1>
        <Link href="/admin/orders" className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/80 transition hover:bg-white/5">
          <ArrowLeft className="h-4 w-4" /> Back to orders
        </Link>
      </div>
    );
  }
  return <OrderDossierClient d={dossier} />;
}
