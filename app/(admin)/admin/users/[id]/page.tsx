import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAdminUserDossier } from "@/lib/data/admin-users";
import { isOwnerActor } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserDossierClient } from "@/components/admin/UserDossierClient";

export const metadata: Metadata = { title: "User dossier · Admin" };
export const dynamic = "force-dynamic";

export default async function UserDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [dossier, viewerIsOwner] = await Promise.all([
    getAdminUserDossier(id),
    isOwnerActor(createAdminClient()),
  ]);

  if (!dossier) {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center">
        <p className="font-mono text-sm uppercase tracking-[0.3em] text-white/40">Account not found</p>
        <h1 className="mt-2 text-2xl font-black text-white">No such user on the grid</h1>
        <Link href="/admin/users" className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/80 transition hover:bg-white/5">
          <ArrowLeft className="h-4 w-4" /> Back to users
        </Link>
      </div>
    );
  }

  return <UserDossierClient d={dossier} viewerIsOwner={viewerIsOwner} />;
}
