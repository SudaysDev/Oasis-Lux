import Link from "next/link";
import { redirect } from "next/navigation";
import { Flag } from "lucide-react";
import { requireUser } from "@/lib/auth/session";

export default async function AdminHubPage() {
  const profile = await requireUser();
  if (profile.role !== "admin") redirect("/home");

  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
      <p className="mb-1 font-mono text-xs uppercase tracking-[0.3em] text-accent/70">Admin</p>
      <h1 className="mb-6 text-3xl font-black">Control room</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/admin/reports"
          className="card group flex items-center gap-4 rounded-2xl p-5 transition hover:border-accent/50"
        >
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-danger/10 text-danger">
            <Flag className="h-6 w-6" />
          </span>
          <div>
            <p className="font-bold">Reports</p>
            <p className="text-sm text-fg-muted">Review user reports & abuse</p>
          </div>
        </Link>
      </div>
    </main>
  );
}
