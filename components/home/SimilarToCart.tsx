"use client";

import { useMemo } from "react";
import { ProductRow } from "./ProductRow";
import { useCart } from "@/hooks/useCart";
import { useFavorites } from "@/hooks/useFavorites";
import { useLiveProducts } from "@/hooks/useLiveProducts";
import { useT } from "@/hooks/useT";
import type { DemoProduct } from "@/lib/landing-data";

/**
 * Context-aware recommendations: products similar to what's in the cart (same
 * type / brand), or — when the cart is empty — to favorites, falling back to
 * top-rated picks. The heading adapts so it reads as a real recommendation.
 */
export function SimilarToCart() {
  const { items } = useCart();
  const { ids: favIds } = useFavorites();
  const { products } = useLiveProducts(60);
  const { t } = useT();

  const { list, title } = useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    const cartSeeds = items.map((i) => byId.get(i.productId)).filter((p): p is DemoProduct => Boolean(p));
    const favSeeds = (favIds ?? []).map((id) => byId.get(id)).filter((p): p is DemoProduct => Boolean(p));
    const seeds = cartSeeds.length ? cartSeeds : favSeeds;

    if (seeds.length === 0) {
      const top = [...products].sort((a, b) => b.rating - a.rating).slice(0, 10);
      return { list: top, title: t("home.recForYou") };
    }

    const seedIds = new Set(seeds.map((s) => s.id));
    const types = new Set(seeds.map((s) => s.type));
    const brands = new Set(seeds.map((s) => s.brand));

    const ranked = products
      .filter((p) => !seedIds.has(p.id))
      .map((p) => ({ p, s: (types.has(p.type) ? 2 : 0) + (brands.has(p.brand) ? 3 : 0) + p.rating / 5 }))
      .filter((x) => x.s > 0.9)
      .sort((a, b) => b.s - a.s)
      .slice(0, 12)
      .map((x) => x.p);

    return {
      list: ranked,
      title: cartSeeds.length ? t("home.becauseCart") : t("home.becauseFav"),
    };
  }, [items, favIds, products, t]);

  if (list.length < 4) return null;
  return <ProductRow id="similar" title={title} products={list} showVariants />;
}
