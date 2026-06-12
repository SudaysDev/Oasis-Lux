"use client";

import Link from "next/link";
import Image from "next/image";
import { useTransition } from "react";
import { ArrowRight, LogOut, ShieldCheck } from "lucide-react";
import { ParticleField } from "@/components/fx/ParticleField";
import { ThemeToggle } from "./ThemeToggle";
import { BRAND } from "@/lib/config";
import { formatTjPhone } from "@/lib/utils";
import type { Role } from "@/types";

type Props = {
  phone?: string;
  username?: string;
  role?: Role;
  logoutAction: () => Promise<void>;
};

export function SignedInNotice({ phone, username, role, logoutAction }: Props) {
  const [pending, startLogout] = useTransition();

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-bg p-6 text-fg">
      <ParticleField className="pointer-events-none absolute inset-0 z-0" />
      <div className="animated-grid pointer-events-none absolute inset-0 z-0 opacity-[0.12]" />
      <ThemeToggle className="absolute right-5 top-5 z-30" />

      <div className="glass relative z-10 w-full max-w-md rounded-2xl p-8">
        <div className="mb-6 flex items-center gap-3">
          <Image src={BRAND.icon} alt={BRAND.name} width={44} height={44} className="rounded-xl" priority />
          <div>
            <p className="text-sm font-semibold leading-tight">{BRAND.name}</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-fg-muted">{BRAND.short}</p>
          </div>
        </div>

        <p className="neon-text mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.3em] text-accent">
          <ShieldCheck className="h-3.5 w-3.5" /> Session Active
        </p>
        <h1 className="text-2xl font-black uppercase tracking-tight">You&apos;re already signed in</h1>
        <p className="mt-2 text-sm text-fg-muted">
          {phone ? (
            <>
              Identity <span className="font-mono text-fg">{formatTjPhone(phone)}</span>
              {username ? <> · @{username}</> : null}
              {role && role !== "customer" ? (
                <span className="neon-border ml-2 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent">
                  {role}
                </span>
              ) : null}
            </>
          ) : (
            "An active session was found on this device."
          )}
        </p>
        <p className="mt-3 text-sm text-fg-muted">
          Sign out to reach the login / registration terminal again.
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/home"
            className="neon-border group flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent/25 to-accent-2/25 px-6 py-3 font-mono text-sm uppercase tracking-[0.15em] transition hover:from-accent/40 hover:to-accent-2/40"
          >
            Continue to Home
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <button
            type="button"
            disabled={pending}
            onClick={() => startLogout(() => logoutAction())}
            className="glass flex items-center justify-center gap-2 rounded-xl px-6 py-3 font-mono text-sm uppercase tracking-[0.15em] text-danger transition hover:bg-danger/10 disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" /> {pending ? "…" : "Log out"}
          </button>
        </div>
      </div>
    </main>
  );
}
