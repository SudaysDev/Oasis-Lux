"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownUp, ArrowRight, Heart, Loader2, ShoppingBag, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useCart } from "@/hooks/useCart";
import { useFavorites } from "@/hooks/useFavorites";
import { useLiveProducts } from "@/hooks/useLiveProducts";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import { ProductCard } from "@/components/shop/ProductCard";
import type { DemoProduct } from "@/lib/landing-data";
import type { ProductType } from "@/types";

const DEFAULT_VARIANT: Record<ProductType, string> = { perfume: "2ml", watch: "Steel", glasses: "Black" };

type Sort = "recent" | "price-asc" | "price-desc" | "rating";
const SORTS: { key: Sort; tkey: string }[] = [
  { key: "recent", tkey: "fav.sortRecent" },
  { key: "price-asc", tkey: "fav.sortPriceAsc" },
  { key: "price-desc", tkey: "fav.sortPriceDesc" },
  { key: "rating", tkey: "fav.sortRating" },
];
type Filter = "all" | "in-stock" | "sale";

export function FavoritesView() {
  const { ids, clearAll, count } = useFavorites();
  const { addRaw, items } = useCart();
  const { products, loading } = useLiveProducts(120);
  const { t } = useT();

  const [clearing, setClearing] = useState(false);
  const [sort, setSort] = useState<Sort>("recent");
  const [filter, setFilter] = useState<Filter>("all");

  // resolve favorite ids → products (newest first: ids append on add)
  const resolved = useMemo(() => {
    const byId = new Map<string, DemoProduct>();
    for (const p of products) byId.set(p.id, p);
    return ids
      .map((id) => byId.get(id))
      .filter((p): p is DemoProduct => Boolean(p))
      .reverse(); // most recently added first
  }, [ids, products]);

  const counts = useMemo(
    () => ({
      all: resolved.length,
      "in-stock": resolved.filter((p) => p.stock > 0).length,
      sale: resolved.filter((p) => p.discount).length,
    }),
    [resolved],
  );

  const view = useMemo(() => {
    let list = resolved;
    if (filter === "in-stock") list = list.filter((p) => p.stock > 0);
    else if (filter === "sale") list = list.filter((p) => p.discount);
    const sorted = [...list];
    if (sort === "price-asc") sorted.sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") sorted.sort((a, b) => b.price - a.price);
    else if (sort === "rating") sorted.sort((a, b) => b.rating - a.rating);
    // "recent" keeps the resolved (reversed) order
    return sorted;
  }, [resolved, filter, sort]);

  const addAllToCart = () => {
    const cartQtyByProduct = new Map<string, number>();
    for (const i of items) cartQtyByProduct.set(i.productId, (cartQtyByProduct.get(i.productId) ?? 0) + i.quantity);

    let added = 0;
    for (const p of view) {
      const already = cartQtyByProduct.get(p.id) ?? 0;
      if (p.stock - already <= 0) continue; // respect local stock
      const variant = p.volume ?? DEFAULT_VARIANT[p.type];
      addRaw({
        productId: p.id,
        variantId: variant,
        title: p.title,
        image: p.image ?? "",
        unitPrice: p.price,
        variantLabel: variant,
        quantity: 1,
      });
      added += 1;
    }
    if (added === 0) toast.error("Everything here is out of stock or already maxed in your cart");
    else toast.success(`${added} item${added > 1 ? "s" : ""} → cart`);
  };

  const clearWishlist = () => {
    setClearing(true);
    clearAll();
    toast.success(t("fav.cleared"));
    setTimeout(() => setClearing(false), 400);
  };

  const empty = ids.length === 0;

  return (
    <div className="mx-auto max-w-6xl">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-black sm:text-4xl">{t("fav.title")}</h1>
          {count > 0 && (
            <span className="rounded-full bg-accent/15 px-3 py-1 font-mono text-xs font-bold text-accent">
              {count} {count > 1 ? t("fav.items") : t("fav.item")}
            </span>
          )}
        </div>
        {!empty && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearWishlist}
              disabled={clearing}
              className="glass flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-fg-muted transition hover:text-danger disabled:opacity-50"
            >
              {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {t("fav.clear")}
            </button>
            <button
              type="button"
              onClick={addAllToCart}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-2 px-4 py-2.5 text-sm font-bold text-black shadow-[0_14px_40px_-14px_var(--accent-glow)] transition hover:brightness-110"
            >
              <ShoppingBag className="h-4 w-4" /> {t("fav.addAll")}
            </button>
          </div>
        )}
      </div>

      {/* filter + sort bar */}
      {!empty && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {([
              ["all", t("fav.fAll")],
              ["in-stock", t("fav.fInStock")],
              ["sale", t("fav.fSale")],
            ] as [Filter, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm font-medium transition",
                  filter === key ? "neon-border text-accent" : "card text-fg-muted hover:text-fg",
                )}
              >
                {label} <span className="font-mono text-xs opacity-70">{counts[key]}</span>
              </button>
            ))}
          </div>
          <label className="card flex items-center gap-2 rounded-xl px-3 py-2 text-sm">
            <ArrowDownUp className="h-4 w-4 text-fg-muted" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="bg-transparent font-medium outline-none"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key} className="bg-bg-elev text-fg">
                  {t(s.tkey)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* empty state */}
      {empty ? (
        <div className="glass mt-8 grid place-items-center rounded-3xl px-6 py-16 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-danger/10 text-danger">
            <Heart className="h-7 w-7" />
          </div>
          <p className="mt-4 text-lg font-bold">{t("fav.empty")}</p>
          <p className="mt-1 text-sm text-fg-muted">{t("fav.emptyHint")}</p>
          <Link
            href="/catalog"
            className="neon-border mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-accent transition hover:bg-accent/10"
          >
            {t("common.browseCatalog")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : loading && resolved.length === 0 ? (
        <p className="mt-10 text-center text-sm text-fg-muted">{t("fav.loading")}</p>
      ) : view.length === 0 ? (
        <p className="glass mt-8 rounded-2xl px-6 py-10 text-center text-sm text-fg-muted">
          {t("fav.noFilter")}
        </p>
      ) : (
        <motion.div layout className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {view.map((p) => (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
              >
                <ProductCard product={p} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
