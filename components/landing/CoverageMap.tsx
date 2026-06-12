"use client";

import { cn } from "@/lib/utils";
import { SectionHeader } from "./SectionHeader";

const CITIES: { name: string; x: number; y: number; hub?: boolean }[] = [
  { name: "Khujand", x: 30, y: 14 },
  { name: "Istaravshan", x: 36, y: 30 },
  { name: "Dushanbe", x: 38, y: 54, hub: true },
  { name: "Bokhtar", x: 40, y: 76 },
  { name: "Kulob", x: 58, y: 70 },
  { name: "Khorog", x: 86, y: 60 },
];

export function CoverageMap() {
  const hub = CITIES.find((c) => c.hub)!;
  return (
    <section id="coverage" className="relative scroll-mt-20 px-6 py-20 sm:px-10">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Tajikistan-wide"
          title="Realtime courier network"
          subtitle="From Khujand to Khorog — live 3D tracking, pulsing hotspots and ETA tickers on every order."
        />
        <div className="glass relative mt-12 overflow-hidden rounded-3xl">
          <div className="grid-mesh absolute inset-0 opacity-20" />
          <div className="relative aspect-[16/9] w-full">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {CITIES.filter((c) => !c.hub).map((c) => (
                <line
                  key={c.name}
                  x1={hub.x}
                  y1={hub.y}
                  x2={c.x}
                  y2={c.y}
                  stroke="#22d3ee"
                  strokeOpacity="0.3"
                  strokeWidth="0.35"
                  strokeDasharray="1.4 1.4"
                />
              ))}
            </svg>
            {CITIES.map((c) => (
              <div
                key={c.name}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                style={{ left: `${c.x}%`, top: `${c.y}%` }}
              >
                <span className={cn("relative flex", c.hub ? "h-4 w-4" : "h-2.5 w-2.5")}>
                  <span
                    className={cn(
                      "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
                      c.hub ? "bg-accent" : "bg-accent-2",
                    )}
                  />
                  <span
                    className={cn(
                      "relative inline-flex rounded-full",
                      c.hub ? "h-4 w-4 bg-accent" : "h-2.5 w-2.5 bg-accent-2",
                    )}
                  />
                </span>
                <span className="mt-1.5 whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-fg-muted">
                  {c.name}
                </span>
              </div>
            ))}
            <span className="absolute bottom-3 right-4 font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
              ◉ live · simulated
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
