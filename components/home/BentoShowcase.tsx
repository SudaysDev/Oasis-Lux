"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Heart, Plus, Star } from "lucide-react";
import { ProductArt } from "@/components/landing/ProductArt";
import { useCart } from "@/hooks/useCart";
import { useFavorites } from "@/hooks/useFavorites";
import { useLiveProducts } from "@/hooks/useLiveProducts";
import { useMoney } from "@/hooks/useMoney";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import type { DemoProduct } from "@/lib/landing-data";

// Instagram-style asymmetric mosaic: every few tiles is taller or wider so the
// grid reads as an editorial feed, not a uniform 4-up row. Pattern repeats.
type Shape = "tall" | "wide" | "big" | "normal";
const PATTERN: Shape[] = ["big", "normal", "normal", "wide", "tall", "normal", "normal", "tall", "wide", "normal"];

const SPAN: Record<Shape, string> = {
  big: "col-span-2 row-span-2",
  tall: "row-span-2",
  wide: "col-span-2",
  normal: "",
};

export function BentoShowcase() {
  const { products } = useLiveProducts(40);
  const { t } = useT();
  const list = products.slice(0, 10);
  if (list.length < 6) return null;

  return (
    <section className="mt-12">
      <div className="mb-5 flex items-center gap-3">
        <h2 className="text-lg font-bold sm:text-xl">{t("home.spotlight")}</h2>
        <span className="h-px flex-1 bg-gradient-to-r from-[var(--panel-border)] to-transparent" />
      </div>

      <div className="grid auto-rows-[10.5rem] grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {list.map((p, i) => {
          const shape = PATTERN[i % PATTERN.length];
          return (
            <motion.div
              key={`${p.id}-${i}`}
              initial={{ opacity: 0, scale: 0.94 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "0px 0px -60px 0px" }}
              transition={{ duration: 0.35, delay: (i % 5) * 0.04 }}
              className={SPAN[shape]}
            >
              <BentoTile product={p} large={shape === "big"} />
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

function BentoTile({ product, large }: { product: DemoProduct; large: boolean }) {
  const { money } = useMoney();
  const { addRaw, items } = useCart();
  const { has, toggleRaw } = useFavorites();
  const fav = has(product.id);
  const inCart = items.filter((i) => i.productId === product.id).reduce((n, i) => n + i.quantity, 0);
  const soldOut = inCart >= product.stock;

  return (
    <div className="group relative h-full overflow-hidden rounded-2xl border border-[var(--panel-border)] transition-shadow duration-300 hover:shadow-[0_24px_55px_-22px_var(--accent-glow)]">
      <Link href={`/product/${product.id}`} aria-label={product.title} className="absolute inset-0">
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image}
            alt={product.title}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[var(--bg-elev)] to-[var(--bg)] transition-transform duration-700 group-hover:scale-110">
            <ProductArt type={product.type} uid={`bento-${product.id}`} hue={product.hue} className="h-[78%] w-[78%]" />
          </div>
        )}
        <div className="hero-scrim pointer-events-none absolute inset-0" />
      </Link>

      {/* discount / favorite */}
      {product.discount ? (
        <span
          className={cn(
            "absolute left-3 top-3 z-10 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold",
            product.discount >= 70 ? "badge-rainbow text-white" : "bg-black/55 text-[#22d3ee] backdrop-blur-md",
          )}
        >
          −{product.discount}%
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => toggleRaw(product.id)}
        aria-label="favorite"
        className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/40 backdrop-blur-md transition hover:scale-110 active:scale-90"
      >
        <Heart className={cn("h-4 w-4", fav ? "fill-danger text-danger" : "text-white/80")} />
      </button>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-2 p-3.5">
        <div className="min-w-0">
          <p className="truncate font-mono text-[9px] uppercase tracking-[0.2em] text-white/60">{product.brand}</p>
          <h3 className={cn("truncate font-semibold text-white", large ? "text-base" : "text-sm")}>{product.title}</h3>
          <div className="mt-0.5 flex items-center gap-2">
            <span className={cn("font-black text-white", large ? "text-lg" : "text-sm")}>{money(product.price)}</span>
            <span className="flex items-center gap-0.5 text-[11px] text-white/70">
              <Star className="h-3 w-3 fill-accent text-accent" />
              {product.rating.toFixed(1)}
            </span>
          </div>
        </div>
        <button
          type="button"
          disabled={soldOut}
          onClick={() =>
            !soldOut &&
            addRaw({ productId: product.id, title: product.title, image: product.image ?? "", unitPrice: product.price, quantity: 1 })
          }
          aria-label="add to cart"
          className={cn(
            "pointer-events-auto grid h-9 w-9 shrink-0 place-items-center rounded-full transition",
            soldOut
              ? "cursor-not-allowed bg-white/10 text-white/40"
              : inCart > 0
                ? "bg-success/80 text-white"
                : "bg-[#22d3ee] text-black hover:scale-110 active:scale-90",
          )}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
