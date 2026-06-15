"use client";

import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import { Ban, Check, Plus } from "lucide-react";
import { ProductArt } from "@/components/landing/ProductArt";
import { useCart } from "@/hooks/useCart";
import { useMoney } from "@/hooks/useMoney";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import { DEMO_PRODUCTS } from "@/lib/landing-data";

const FEATURED = DEMO_PRODUCTS.filter((p) => p.tag || (p.discount ?? 0) >= 40).slice(0, 4);

export function FeaturedCarousel() {
  const { addRaw, items } = useCart();
  const { money } = useMoney();
  const { t } = useT();

  return (
    <section className="mt-8">
      <Swiper
        modules={[Autoplay, Pagination]}
        loop
        grabCursor
        speed={650}
        autoplay={{ delay: 4500, disableOnInteraction: false, pauseOnMouseEnter: true }}
        pagination={{ clickable: true }}
        className="oasis-featured rounded-3xl"
      >
        {FEATURED.map((p) => {
          const oldPrice = p.discount ? Math.round(p.price / (1 - p.discount / 100)) : null;
          const inCartQty = items.filter((i) => i.productId === p.id).reduce((n, i) => n + i.quantity, 0);
          const soldOut = inCartQty >= p.stock;
          return (
            <SwiperSlide key={p.id}>
              <div className="glass relative grid gap-6 overflow-hidden rounded-3xl p-8 sm:grid-cols-2 sm:p-10">
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{ background: "radial-gradient(circle at 80% 15%, rgba(168,85,247,0.18), transparent 55%)" }}
                />
                <div className="relative flex flex-col justify-center">
                  <p className="neon-text font-mono text-[11px] uppercase tracking-[0.3em] text-accent">
                    {p.tag ?? t("home.limitedDrop")}
                  </p>
                  <h3 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{p.title}</h3>
                  <p className="mt-1 font-mono text-xs uppercase tracking-[0.2em] text-fg-muted">
                    {p.brand}
                    {p.volume ? ` · ${p.volume}` : ""}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <span className="text-2xl font-black">{money(p.price)}</span>
                    {oldPrice && <span className="font-mono text-sm text-fg-muted line-through">{money(oldPrice)}</span>}
                    {p.discount ? (
                      <span className="badge-rainbow rounded-full px-2 py-0.5 text-xs font-bold text-white">−{p.discount}%</span>
                    ) : null}
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={soldOut}
                      onClick={() => !soldOut && addRaw({ productId: p.id, title: p.title, image: "", unitPrice: p.price, quantity: 1 })}
                      className={cn(
                        "group flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition",
                        soldOut
                          ? "cursor-not-allowed border border-[var(--panel-border)] text-fg-muted opacity-60"
                          : "neon-border bg-gradient-to-r from-accent/25 to-accent-2/25 hover:from-accent/40 hover:to-accent-2/40",
                      )}
                    >
                      {soldOut ? <Ban className="h-4 w-4" /> : inCartQty > 0 ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      {soldOut ? t("common.soldOut") : inCartQty > 0 ? `${t("common.inCart")} · ${inCartQty}` : t("common.addToCart")}
                    </button>
                    <Link href={`/product/${p.id}`} className="glass flex items-center rounded-full px-6 py-3 text-sm transition hover:neon-border">
                      {t("common.viewProduct")}
                    </Link>
                  </div>
                </div>
                <Link href={`/product/${p.id}`} aria-label={p.title} className="relative mx-auto block h-52 w-full max-w-xs transition-transform hover:scale-105">
                  <ProductArt type={p.type} uid={`feat-${p.id}`} hue={p.hue} className="h-full w-full" />
                </Link>
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </section>
  );
}
