"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Ban, Check, Heart, Plus, Star } from "lucide-react";
import { ProductArt } from "@/components/landing/ProductArt";
import { useCart } from "@/hooks/useCart";
import { useFavorites } from "@/hooks/useFavorites";
import { useMoney } from "@/hooks/useMoney";
import { useT } from "@/hooks/useT";
import { useAppSelector } from "@/store/hooks";
import { findPromo, promoPercentForProduct } from "@/lib/promo-codes";
import { cn } from "@/lib/utils";
import type { DemoProduct } from "@/lib/landing-data";
import type { ProductType } from "@/types";

const VARIANTS: Record<ProductType, string[]> = {
  perfume: ["2ml", "5ml", "10ml"],
  watch: ["Steel", "Black", "Gold"],
  glasses: ["Black", "Tortoise", "Clear"],
};

function DiscountBadge({ pct, promo }: { pct: number; promo?: boolean }) {
  const tier =
    pct >= 70
      ? "badge-rainbow text-white shadow-[0_0_18px_rgba(168,85,247,0.6)]"
      : pct >= 40
        ? "bg-gradient-to-r from-accent to-accent-2 text-on-accent"
        : "bg-accent/20 text-accent";
  return (
    <span className={cn("absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[11px] font-bold", tier)}>
      {promo && <span className="text-[8px] uppercase opacity-80">promo</span>}−{pct}%
    </span>
  );
}

type Props = {
  product: DemoProduct;
  showVariants?: boolean;
  /** Gate add-to-cart / favorite behind login (used on the public landing). */
  requireAuth?: boolean;
};

export function ProductCard({ product, showVariants = false, requireAuth = false }: Props) {
  const { add, addRaw, items } = useCart();
  const { has, toggle, toggleRaw } = useFavorites();
  const { money } = useMoney();
  const { t } = useT();
  const [variant, setVariant] = useState(product.volume ?? VARIANTS[product.type][0]);

  const promoCode = useAppSelector((s) => s.promo.code);
  const promoPct = promoCode
    ? promoPercentForProduct(findPromo(promoCode), { id: product.id, brand: product.brand, type: product.type, tags: product.tags })
    : 0;

  const fav = has(product.id);
  const inCartQty = items.filter((i) => i.productId === product.id).reduce((n, i) => n + i.quantity, 0);
  const remaining = product.stock - inCartQty;
  const soldOut = remaining <= 0;
  // an active scoped promo previews a reduced price; otherwise show the product's own deal
  const displayPrice = promoPct > 0 ? Math.round(product.price * (1 - promoPct / 100)) : product.price;
  const oldPrice =
    promoPct > 0
      ? product.price
      : product.discount
        ? Math.round(product.price / (1 - product.discount / 100))
        : null;
  const badgePct = promoPct > 0 ? promoPct : product.discount ?? 0;

  const handleAdd = () => {
    if (soldOut) return;
    (requireAuth ? add : addRaw)({
      productId: product.id,
      variantId: variant,
      title: product.title,
      image: "",
      unitPrice: product.price,
      variantLabel: variant,
      quantity: 1,
    });
  };
  const handleFav = () => (requireAuth ? toggle : toggleRaw)(product.id);

  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="group glass relative flex h-full flex-col overflow-hidden rounded-2xl p-4 transition-shadow duration-300 hover:neon-border hover:shadow-[0_22px_55px_-18px_var(--accent-glow)]"
    >
      {/* sheen sweep on hover */}
      <span className="pointer-events-none absolute -inset-x-10 -top-10 h-24 -translate-y-full rotate-12 bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-y-[420px]" />

      {badgePct > 0 ? <DiscountBadge pct={badgePct} promo={promoPct > 0} /> : null}
      {product.tag && badgePct === 0 ? (
        <span className="absolute left-3 top-3 z-10 rounded-full bg-bg-elev/80 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-accent">
          {product.tag}
        </span>
      ) : null}

      <button
        type="button"
        onClick={handleFav}
        aria-label={t("common.toggleFav")}
        className="glass absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full transition hover:scale-110 active:scale-90"
      >
        <Heart className={cn("h-4 w-4 transition-colors", fav ? "fill-danger text-danger" : "text-fg-muted")} />
      </button>

      <Link href={`/product/${product.id}`} prefetch={false} aria-label={product.title} className="block">
        <div
          className={cn(
            "relative mx-auto h-40 w-full overflow-hidden rounded-xl transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-2",
            soldOut && "opacity-50 grayscale",
          )}
        >
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image} alt={product.title} className="h-full w-full object-cover" />
          ) : (
            <ProductArt type={product.type} uid={`pc-${product.id}`} hue={product.hue} className="h-full w-full" />
          )}
        </div>

        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-muted">
          {product.brand}
          {product.volume ? ` · ${product.volume}` : ""}
        </p>
        <h3 className="mt-1 line-clamp-1 text-sm font-semibold transition-colors group-hover:text-accent">{product.title}</h3>

        <div className="mt-1 flex items-center gap-2 text-xs text-fg-muted">
          <span className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-accent text-accent" />
            {product.rating.toFixed(1)}
          </span>
          {soldOut ? (
            <span className="font-mono text-[11px] text-danger">· {t("card.outOfStock")}</span>
          ) : remaining <= 5 ? (
            <span className="font-mono text-[11px] text-amber-400">· {remaining} {t("prod.left")}</span>
          ) : null}
        </div>

        {product.desc && (
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-fg-muted/80">{product.desc}</p>
        )}
      </Link>

      {showVariants && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {VARIANTS[product.type].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVariant(v)}
              className={cn(
                "rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide transition",
                variant === v
                  ? "neon-border text-accent"
                  : "border-[var(--panel-border)] text-fg-muted hover:text-fg",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className={cn("text-base font-black", promoPct > 0 && "text-accent")}>{money(displayPrice)}</p>
          {oldPrice && <p className="font-mono text-[11px] text-fg-muted line-through">{money(oldPrice)}</p>}
        </div>
        <motion.button
          type="button"
          onClick={handleAdd}
          disabled={soldOut}
          whileTap={soldOut ? undefined : { scale: 0.88 }}
          aria-label={
            soldOut
              ? `${product.title} sold out`
              : inCartQty > 0
                ? `${product.title} in cart (${inCartQty})`
                : `Add ${product.title} to cart`
          }
          className={cn(
            "flex h-9 items-center gap-1.5 overflow-hidden rounded-xl px-2.5 transition",
            soldOut
              ? "cursor-not-allowed border border-[var(--panel-border)] text-fg-muted opacity-60"
              : inCartQty > 0
                ? "border border-success/60 bg-success/15 text-success"
                : "neon-border text-accent hover:bg-accent/10",
          )}
        >
          {soldOut ? (
            <Ban className="h-4 w-4 shrink-0" />
          ) : inCartQty > 0 ? (
            <motion.span
              key="check"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 18 }}
            >
              <Check className="h-4 w-4 shrink-0" />
            </motion.span>
          ) : (
            <Plus className="h-4 w-4 shrink-0" />
          )}
          <span
            className={cn(
              "overflow-hidden whitespace-nowrap text-xs font-medium transition-all duration-300",
              soldOut || inCartQty > 0
                ? "max-w-[5rem] opacity-100"
                : "max-w-0 opacity-0 group-hover:max-w-[4.5rem] group-hover:opacity-100",
            )}
          >
            {soldOut ? t("common.soldOut") : inCartQty > 0 ? `${t("card.added")} ${inCartQty}` : t("card.add")}
          </span>
        </motion.button>
      </div>
    </motion.div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="glass flex h-full flex-col rounded-2xl p-4">
      <div className="mx-auto h-40 w-full animate-pulse rounded-xl bg-[var(--panel-border)]" />
      <div className="mt-3 h-2.5 w-1/3 animate-pulse rounded bg-[var(--panel-border)]" />
      <div className="mt-2 h-3.5 w-2/3 animate-pulse rounded bg-[var(--panel-border)]" />
      <div className="mt-4 flex items-center justify-between">
        <div className="h-5 w-16 animate-pulse rounded bg-[var(--panel-border)]" />
        <div className="h-9 w-9 animate-pulse rounded-xl bg-[var(--panel-border)]" />
      </div>
    </div>
  );
}
