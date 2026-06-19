import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bike, LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { logoutAction } from "@/app/(auth)/actions";

export const metadata: Metadata = { title: "Courier Terminal" };

export default async function CourierPage() {
  const profile = await requireUser();
  if (profile.role !== "courier") redirect("/home");

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-6 text-fg">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-accent/10 text-accent">
          <Bike className="h-7 w-7" />
        </span>
        <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-accent">Courier Terminal</p>
        <h1 className="mt-2 text-3xl font-black">Welcome, {profile.username}</h1>
        <p className="mt-2 text-sm text-fg-muted">
          Your delivery dashboard — assigned routes, pick-up / arrival controls and live ETA — is being
          built. You can already accept orders flagged to you.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/home"
            className="rounded-xl border border-[var(--panel-border)] px-4 py-2.5 text-sm transition hover:bg-white/5"
          >
            Go to storefront
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-xl bg-danger/10 px-4 py-2.5 text-sm text-danger transition hover:bg-danger/20"
            >
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
