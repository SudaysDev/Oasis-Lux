"use client";

import Link from "next/link";
import { ArrowRight, Truck } from "lucide-react";

// Orders aren't wired yet, so this is an honest empty state — the real live 3D
// map + courier/ETA tickers live on /order/[id]/track once an order exists.
const CITIES = [
  { x: 30, y: 18 },
  { x: 38, y: 54 },
  { x: 60, y: 72 },
  { x: 82, y: 46 },
];

export function LiveTracker() {
  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fg-muted/40" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-fg-muted" />
        </span>
        <h2 className="text-lg font-bold sm:text-xl">Live courier tracker</h2>
      </div>

      <div className="glass relative overflow-hidden rounded-3xl p-8 text-center sm:p-12">
        <div className="grid-mesh absolute inset-0 opacity-10" />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full opacity-30">
          {CITIES.slice(1).map((c, i) => (
            <line
              key={i}
              x1={CITIES[0].x}
              y1={CITIES[0].y}
              x2={c.x}
              y2={c.y}
              stroke="#22d3ee"
              strokeOpacity="0.25"
              strokeWidth="0.3"
              strokeDasharray="1.4 1.4"
            />
          ))}
        </svg>
        {CITIES.map((c, i) => (
          <span
            key={i}
            className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/40"
            style={{ left: `${c.x}%`, top: `${c.y}%` }}
          />
        ))}

        <div className="relative">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-accent/10 text-accent">
            <Truck className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No active deliveries yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">
            Your live 3D courier map — driver name, real-time distance and an ETA countdown across
            Tajikistan — appears here the moment you place your first order.
          </p>
          <Link
            href="/catalog"
            className="neon-border group mt-6 inline-flex items-center gap-2 rounded-full px-6 py-3 font-mono text-xs uppercase tracking-[0.15em] transition hover:scale-105"
          >
            Browse catalog
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}
