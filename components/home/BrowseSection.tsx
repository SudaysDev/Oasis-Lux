"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BadgePercent, Flame, Glasses, LayoutGrid, SprayCan, Wallet, Watch, type LucideIcon } from "lucide-react";
import { ProductCard } from "@/components/shop/ProductCard";
import { useT } from "@/hooks/useT";
import { DEMO_PRODUCTS, type DemoProduct } from "@/lib/landing-data";
import { cn } from "@/lib/utils";

type FilterKey = "all" | "perfume" | "watch" | "glasses" | "popular" | "deals" | "cheap";

const FILTERS: { key: FilterKey; tkey: string; icon: LucideIcon }[] = [
  { key: "all", tkey: "filter.all", icon: LayoutGrid },
  { key: "perfume", tkey: "filter.perfumes", icon: SprayCan },
  { key: "watch", tkey: "filter.watches", icon: Watch },
  { key: "glasses", tkey: "filter.glasses", icon: Glasses },
  { key: "popular", tkey: "filter.popular", icon: Flame },
  { key: "deals", tkey: "filter.deals", icon: BadgePercent },
  { key: "cheap", tkey: "filter.cheap", icon: Wallet },
];

function matches(p: DemoProduct, f: FilterKey): boolean {
  switch (f) {
    case "all":
      return true;
    case "popular":
      return p.rating >= 4.8;
    case "deals":
      return Boolean(p.discount);
    case "cheap":
      return p.price < 100;
    default:
      return p.type === f;
  }
}

export function BrowseSection() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const { t } = useT();
  const list = DEMO_PRODUCTS.filter((p) => matches(p, filter));

  return (
    <section className="mt-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold sm:text-xl">{t("home.browseGrid")}</h2>
        <div className="flex flex-wrap gap-2">
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

      <motion.div layout className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <AnimatePresence mode="popLayout">
          {list.map((p) => (
            <motion.div
              key={p.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.25 }}
            >
              <ProductCard product={p} showVariants />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {list.length === 0 && (
        <p className="py-10 text-center text-sm text-fg-muted">{t("home.nothingFilter")}</p>
      )}
    </section>
  );
}
