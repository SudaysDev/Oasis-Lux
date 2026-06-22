import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth/session";
import { getAdminThread } from "@/lib/data/admin-messages";
import { AdminThreadClient } from "@/components/admin/AdminThreadClient";

export const metadata: Metadata = { title: "Thread · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [thread, me] = await Promise.all([getAdminThread(id), getCurrentProfile()]);

  if (!thread) {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center">
        <p className="font-mono text-sm uppercase tracking-[0.3em] text-white/40">Conversation not found</p>
        <Link href="/admin/messages" className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/80 transition hover:bg-white/5">
          <ArrowLeft className="h-4 w-4" /> Back to messages
        </Link>
      </div>
    );
  }

  return <AdminThreadClient t={thread} me={{ id: me?.id ?? "", username: me?.username ?? "admin" }} />;
}
