"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductArt } from "@/components/landing/ProductArt";
import { useLiveProducts } from "@/hooks/useLiveProducts";
import { useMoney } from "@/hooks/useMoney";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import type { DemoProduct } from "@/lib/landing-data";

/**
 * Editorial "magazine" hero — NOT a swiper. One large feature tile plus two
 * smaller tiles stacked beside it (their combined height matches the big one).
 * The product art is the *background*; the copy (brand · title · price · a
 * text "view product" link) floats inside the image, scrim-darkened for legibility.
 */
export function FeaturedHero() {
  const { products } = useLiveProducts(24);
  const { t } = useT();

  // Lead with the most striking items: tagged, then biggest discounts, then top rated.
  const picks = [...products]
    .sort((a, b) => score(b) - score(a))
    .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)
    .slice(0, 3);

  if (picks.length < 3) return null;
  const [big, ...small] = picks;

  return (
    <section className="mt-8">
      <div className="grid gap-4 lg:grid-cols-2">
        <HeroTile product={big} size="lg" badge={big.tag ?? t("home.featured")} />
        <div className="grid gap-4">
          {small.map((p) => (
            <HeroTile key={p.id} product={p} size="sm" badge={p.tag ?? t("home.handpicked")} />
          ))}
        </div>
      </div>
    </section>
  );
}

function score(p: DemoProduct): number {
  return (p.tag ? 50 : 0) + (p.discount ?? 0) + p.rating * 5 + (p.isLive ? 40 : 0);
}

function HeroTile({
  product,
  size,
  badge,
}: {
  product: DemoProduct;
  size: "lg" | "sm";
  badge: string;
}) {
  const { money } = useMoney();
  const { t } = useT();
  const oldPrice = product.discount ? Math.round(product.price / (1 - product.discount / 100)) : null;

  return (
    <Link
      href={`/product/${product.id}`}
      aria-label={product.title}
      className={cn(
        "group relative block overflow-hidden rounded-3xl border border-[var(--panel-border)] transition-shadow duration-300 hover:shadow-[0_30px_70px_-24px_var(--accent-glow)]",
        size === "lg" ? "min-h-[22rem] lg:min-h-[34rem]" : "min-h-[16rem] lg:min-h-[16.25rem]",
      )}
    >
      {/* the product art IS the background */}
      <div className="absolute inset-0">
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image}
            alt={product.title}
            className="hero-kenburns h-full w-full object-cover"
          />
        ) : (
          <div className="hero-kenburns grid h-full w-full place-items-center bg-gradient-to-br from-[var(--bg-elev)] to-[var(--bg)]">
            <ProductArt
              type={product.type}
              uid={`hero-${product.id}`}
              hue={product.hue}
              className={cn("opacity-90", size === "lg" ? "h-[80%] w-[80%]" : "h-[78%] w-[78%]")}
            />
          </div>
        )}
      </div>

      {/* legibility scrim */}
      <div className="hero-scrim pointer-events-none absolute inset-0" />

      {/* top badge */}
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
        <span className="rounded-full bg-black/55 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-[#22d3ee] backdrop-blur-md">
          {badge}
        </span>
        {product.discount ? (
          <span
            className={cn(
              "rounded-full px-2.5 py-1 font-mono text-[11px] font-bold",
              product.discount >= 70
                ? "badge-rainbow text-white shadow-[0_0_18px_rgba(168,85,247,0.6)]"
                : product.discount >= 40
                  ? "bg-gradient-to-r from-accent to-accent-2 text-on-accent"
                  : "bg-accent/25 text-accent",
            )}
          >
            −{product.discount}%
          </span>
        ) : null}
      </div>

      {/* overlaid copy — lives INSIDE the image */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1 p-5 sm:p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/70">
          {product.brand}
          {product.volume ? ` · ${product.volume}` : ""}
        </p>
        <h3
          className={cn(
            "font-black tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]",
            size === "lg" ? "text-3xl sm:text-4xl" : "text-xl sm:text-2xl",
          )}
        >
          {product.title}
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-2.5">
          <span className={cn("font-black text-white", size === "lg" ? "text-2xl" : "text-lg")}>
            {money(product.price)}
          </span>
          {oldPrice && (
            <span className="font-mono text-xs text-white/55 line-through">{money(oldPrice)}</span>
          )}
        </div>
        {/* a text "link", not a bordered button */}
        <span className="hero-link mt-2 text-sm text-[#22d3ee]">
          {t("common.viewProduct")}
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}
