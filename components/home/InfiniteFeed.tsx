"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BadgePercent, Flame, Glasses, Loader2, Sparkles, SprayCan, Wallet, Watch, type LucideIcon } from "lucide-react";
import { ProductCard, ProductCardSkeleton } from "@/components/shop/ProductCard";
import { useLiveProducts } from "@/hooks/useLiveProducts";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import type { DemoProduct } from "@/lib/landing-data";

type FilterKey = "all" | "perfume" | "watch" | "glasses" | "popular" | "deals" | "cheap";

const FILTERS: { key: FilterKey; tkey: string; icon: LucideIcon }[] = [
  { key: "all", tkey: "filter.forYou", icon: Sparkles },
  { key: "perfume", tkey: "filter.perfumes", icon: SprayCan },
  { key: "watch", tkey: "filter.watches", icon: Watch },
  { key: "glasses", tkey: "filter.glasses", icon: Glasses },
  { key: "popular", tkey: "filter.popular", icon: Flame },
  { key: "deals", tkey: "filter.deals", icon: BadgePercent },
  { key: "cheap", tkey: "filter.cheap", icon: Wallet },
];

function matches(p: DemoProduct, f: FilterKey): boolean {
  switch (f) {
    case "all": return true;
    case "popular": return p.rating >= 4.7;
    case "deals": return Boolean(p.discount);
    case "cheap": return p.price < 100;
    default: return p.type === f;
  }
}

const BATCH = 12;
const MAX = 144; // generous cap so the page feels endless without unbounded DOM

// deterministic shuffle so each "page" of the cycled feed looks fresh but stays stable across renders
function seededOrder<T>(arr: T[], seed: number): T[] {
  return arr
    .map((v, i) => ({ v, r: ((i + 1) * 9301 + seed * 49297) % 233280 }))
    .sort((a, b) => a.r - b.r)
    .map((x) => x.v);
}

function buildFeed(base: DemoProduct[], n: number): { p: DemoProduct; key: string }[] {
  const out: DemoProduct[] = [];
  let cycle = 0;
  while (out.length < n && base.length > 0) {
    for (const p of seededOrder(base, cycle)) {
      if (out.length >= n) break;
      out.push(p);
    }
    cycle += 1;
  }
  return out.map((p, i) => ({ p, key: `${p.id}-${i}` }));
}

export function InfiniteFeed() {
  const { products, loading } = useLiveProducts(120);
  const [filter, setFilter] = useState<FilterKey>("all");
  const { t } = useT();
  const filtered = useMemo(() => products.filter((p) => matches(p, filter)), [products, filter]);

  return (
    <section className="mt-12">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/50" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
          </span>
          <h2 className="text-lg font-bold sm:text-xl">{t("home.recommended")}</h2>
        </div>
        <div className="no-scrollbar flex max-w-full flex-wrap gap-2">
          {FILTERS.map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] transition",
                  filter === f.key ? "neon-border text-accent" : "glass text-fg-muted hover:text-fg",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t(f.tkey)}
              </button>
            );
          })}
        </div>
      </div>

      {loading && products.length === 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-fg-muted">{t("home.nothingFilter")}</p>
      ) : (
        <FeedGrid key={filter} base={filtered} />
      )}
    </section>
  );
}

function FeedGrid({ base }: { base: DemoProduct[] }) {
  const { t } = useT();
  const [count, setCount] = useState(BATCH);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const feed = useMemo(() => buildFeed(base, count), [base, count]);
  const done = count >= MAX;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || done) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) setCount((c) => Math.min(MAX, c + BATCH)); },
      { rootMargin: "700px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [done]);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {feed.map(({ p, key }, i) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "0px 0px -40px 0px" }}
            transition={{ duration: 0.3, delay: (i % BATCH) * 0.02 }}
          >
            <ProductCard product={p} />
          </motion.div>
        ))}
      </div>

      {done ? (
        <p className="py-10 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-fg-muted">
          {t("home.caughtUp")}
        </p>
      ) : (
        <div ref={sentinelRef} className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      )}
    </>
  );
}
