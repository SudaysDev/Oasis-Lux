import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function CtaSection() {
  return (
    <section className="relative px-6 py-24 sm:px-10">
      <div className="glass relative mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] p-10 text-center sm:p-16">
        <div className="grid-mesh absolute inset-0 opacity-20" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(circle at 50% 0%, rgba(34,211,238,0.18), transparent 60%)" }}
        />
        <div className="relative">
          <p className="neon-text font-mono text-[11px] uppercase tracking-[0.3em] text-accent">
            Your number is your key
          </p>
          <h2 className="mt-4 text-4xl font-black uppercase tracking-tight sm:text-5xl">
            Join the OASIS LUX grid
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-fg-muted">
            Sign up in 20 seconds with a +992 number — grab a welcome promo, link a social, and start
            ordering luxury across Tajikistan.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/register"
              className="neon-border group flex items-center gap-2 rounded-full bg-gradient-to-r from-accent/25 to-accent-2/25 px-7 py-3.5 font-mono text-sm uppercase tracking-[0.15em] transition hover:from-accent/40 hover:to-accent-2/40"
            >
              Initialize identity
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/login"
              className="glass flex items-center rounded-full px-7 py-3.5 font-mono text-sm uppercase tracking-[0.15em] transition hover:neon-border"
            >
              I already have access
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
