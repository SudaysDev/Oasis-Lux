"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Swiper, SwiperSlide } from "swiper/react";
import { FreeMode, Mousewheel } from "swiper/modules";
import "swiper/css";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Heart,
  Minus,
  MessageCircle,
  Package,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Star,
  Truck,
  Zap,
} from "lucide-react";
import toast from "react-hot-toast";
import { getBrowserClient } from "@/lib/supabase/client";
import { fetchProductDetail, fetchSellerMini, type ProductDetail as PD } from "@/lib/data/products";
import { DEMO_PRODUCTS, type DemoProduct } from "@/lib/landing-data";
import { useLiveProducts } from "@/hooks/useLiveProducts";
import { useCart } from "@/hooks/useCart";
import { useFavorites } from "@/hooks/useFavorites";
import { useMoney } from "@/hooks/useMoney";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import { TJ } from "@/lib/config";
import { Avatar } from "@/components/profile/Avatar";
import { PlanBadge, VerifiedBadge } from "@/components/profile/Badges";
import { ProductCard } from "@/components/shop/ProductCard";
import { ProductGallery } from "@/components/shop/ProductGallery";
import { ProductReviews } from "@/components/shop/ProductReviews";
import type { MiniProfile, ProductType } from "@/types";

// ---------------------------------------------------------------------------
const VOLUMES: { label: string; mult: number }[] = [
  { label: "2ml", mult: 0.3 },
  { label: "5ml", mult: 0.55 },
  { label: "10ml", mult: 1 },
  { label: "100ml", mult: 6 },
];

const COLOR_FALLBACK: Record<ProductType, string[]> = {
  perfume: [],
  watch: ["Steel", "Black", "Gold", "Rose Gold"],
  glasses: ["Black", "Tortoise", "Clear", "Blue"],
};

const NAMED_COLORS: Record<string, string> = {
  black: "#1c1c1e", white: "#f5f5f7", steel: "#b8c0cc", silver: "#cdd3da",
  gold: "#d4af37", "rose gold": "#e0a899", clear: "#dfeaf2", tortoise: "#6b4423",
  blue: "#3b82f6", navy: "#1e3a8a", green: "#22c55e", red: "#ef4444", brown: "#7c4a2d",
  beige: "#d9c7a3", pink: "#ec4899", purple: "#a855f7", grey: "#6b7280", gray: "#6b7280",
  orange: "#f97316", yellow: "#eab308", cyan: "#22d3ee",
};
const colorHex = (name: string) => NAMED_COLORS[name.trim().toLowerCase()] ?? "#7c8aa0";

const CONDITION_KEY: Record<string, string> = { new: "prod.condNew", like_new: "prod.condLikeNew", used: "prod.condUsed" };

function toDetail(p: DemoProduct): PD {
  return { ...p, images: p.image ? [p.image] : [], descriptionHtml: undefined };
}

/** Strip script/style + inline event handlers from seller-authored HTML. */
function sanitize(html: string): string {
  return html
    .replace(/<\/?(script|style|iframe)[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

// ---------------------------------------------------------------------------
export function ProductDetail({ productId }: { productId: string }) {
  const router = useRouter();
  const sb = getBrowserClient();
  const { money } = useMoney();
  const { t } = useT();
  const { items, addRaw } = useCart();
  const { has, toggleRaw } = useFavorites();
  const { products: allProducts } = useLiveProducts(60);

  // The demo seed resolves synchronously; live listings are fetched async.
  // The page remounts this component per `id` (key={id}), so the fetch runs once.
  const demo = useMemo(() => DEMO_PRODUCTS.find((p) => p.id === productId), [productId]);
  const [fetched, setFetched] = useState<{ product: PD | null } | null>(null);
  const [seller, setSeller] = useState<MiniProfile | null>(null);

  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    void fetchProductDetail(sb, productId).then(async (d) => {
      if (cancelled) return;
      setFetched({ product: d });
      if (d?.sellerId) {
        const s = await fetchSellerMini(sb, d.sellerId);
        if (!cancelled) setSeller(s);
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, demo]);

  const product = demo ? toDetail(demo) : fetched?.product ?? null;
  const resolving = !demo && fetched === null;
  const notFound = !demo && fetched !== null && fetched.product === null;

  // ---- variant state (derived defaults; user picks override) ---------------
  const isPerfume = product?.type === "perfume";
  const colorOptions = useMemo(
    () => (product ? (product.colors?.length ? product.colors : COLOR_FALLBACK[product.type]) : []),
    [product],
  );
  const defaultVolIdx = useMemo(() => {
    const i = VOLUMES.findIndex((v) => v.label === product?.volume);
    return i >= 0 ? i : 2; // 10ml
  }, [product?.volume]);

  const [volPick, setVolPick] = useState<number | null>(null);
  const [colorPick, setColorPick] = useState<string | null>(null);
  const [qty, setQty] = useState(1);

  const volIdx = volPick ?? defaultVolIdx;
  const color = colorPick ?? colorOptions[0] ?? null;

  if (resolving) return <DetailSkeleton />;
  if (notFound || !product) return <NotFound />;

  const variantLabel = isPerfume ? VOLUMES[volIdx].label : color ?? undefined;
  const variantId = variantLabel;
  const unitPrice = Math.round(product.price * (isPerfume ? VOLUMES[volIdx].mult : 1));
  const oldUnit = product.discount ? Math.round(unitPrice / (1 - product.discount / 100)) : null;

  // Stock is shared across a product's variants, so the *local* "remaining"
  // must subtract EVERY cart line for this product (all volumes/colours), not
  // just the active variant. (Real DB stock only drops 15 min after payment.)
  const cartQtyAll = items
    .filter((i) => i.productId === product.id)
    .reduce((n, i) => n + i.quantity, 0);
  const inCartQty = items
    .filter((i) => i.productId === product.id && i.variantId === variantId)
    .reduce((n, i) => n + i.quantity, 0);
  const remaining = product.stock - cartQtyAll;
  const soldOut = remaining <= 0;
  const maxAdd = Math.max(1, remaining);
  const clampedQty = Math.min(qty, maxAdd); // qty can go stale after an add shrinks remaining
  const fav = has(product.id);

  const addToCart = (): boolean => {
    if (soldOut) {
      toast.error(t("common.outOfStock"));
      return false;
    }
    addRaw({
      productId: product.id,
      variantId,
      title: product.title,
      image: product.images[0] ?? "",
      unitPrice,
      variantLabel,
      quantity: clampedQty,
    });
    setQty(1); // reset the picker so the next add starts fresh
    return true;
  };

  const buyNow = () => {
    if (addToCart()) router.push("/cart");
  };

  const messageSeller = () => {
    if (product.sellerId) {
      router.push(`/messages/${product.sellerId}`);
    } else {
      toast(t("prod.demoNoSeller"), { icon: "🏬" });
      router.push("/messages");
    }
  };

  const description =
    product.descriptionHtml ? sanitize(product.descriptionHtml) : null;

  return (
    <div className="mx-auto max-w-6xl">
      {/* breadcrumb */}
      <nav className="mb-5 flex flex-wrap items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-fg-muted">
        <Link href="/catalog" className="transition hover:text-accent">{t("nav.catalog")}</Link>
        <span>/</span>
        <Link href={`/catalog?cat=${product.type}`} className="transition hover:text-accent">{product.type}</Link>
        <span>/</span>
        <span className="text-fg">{product.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        {/* LEFT — media */}
        <ProductGallery
          type={product.type}
          hue={product.hue}
          title={product.title}
          images={product.images}
          discount={product.discount}
        />

        {/* RIGHT — info */}
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">{product.brand}</p>
          <h1 className="mt-1.5 text-3xl font-black sm:text-4xl">{product.title}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <a href="#reviews" className="flex items-center gap-1.5 text-fg-muted transition hover:text-accent">
              <Star className="h-4 w-4 fill-accent text-accent" />
              <span className="font-semibold text-fg">{product.rating.toFixed(1)}</span> {t("prod.reviews")}
            </a>
            <span className="text-fg-muted/40">·</span>
            {soldOut ? (
              <span className="flex items-center gap-1.5 font-mono text-xs text-danger">
                <span className="h-2 w-2 rounded-full bg-danger" /> {t("prod.outOfStockCaps")}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 font-mono text-xs text-success">
                <span className="h-2 w-2 animate-pulse rounded-full bg-success shadow-[0_0_8px_var(--success)]" />
                {t("prod.inStockCaps")}{remaining <= 5 ? ` · ${remaining} ${t("prod.left")}` : ""}
              </span>
            )}
            {product.condition && product.condition !== "new" && (
              <span className="rounded-full bg-[var(--panel)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-fg-muted">
                {t(CONDITION_KEY[product.condition])}
              </span>
            )}
          </div>

          {/* price */}
          <div className="mt-5 flex items-end gap-3">
            <AnimatePresence mode="popLayout">
              <motion.span
                key={unitPrice}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="text-4xl font-black"
              >
                {money(unitPrice)}
              </motion.span>
            </AnimatePresence>
            {oldUnit && <span className="pb-1 font-mono text-base text-fg-muted line-through">{money(oldUnit)}</span>}
            {product.discount ? (
              <span
                className={cn(
                  "mb-1 rounded-full px-2.5 py-1 font-mono text-[11px] font-bold",
                  product.discount >= 70
                    ? "badge-rainbow text-white"
                    : product.discount >= 40
                      ? "bg-gradient-to-r from-accent to-accent-2 text-black"
                      : "bg-accent/20 text-accent",
                )}
              >
                −{product.discount}%
              </span>
            ) : null}
          </div>

          {/* perfume volume selector */}
          {isPerfume && (
            <div className="mt-7">
              <div className="mb-2.5 flex items-center justify-between">
                <p className="font-mono text-xs uppercase tracking-wider text-fg-muted">{t("prod.volume")}</p>
                <span className="font-mono text-xs text-accent">{VOLUMES[volIdx].label} {t("prod.selected")}</span>
              </div>
              <div className="grid grid-cols-4 gap-2.5">
                {VOLUMES.map((v, i) => (
                  <button
                    key={v.label}
                    type="button"
                    onClick={() => setVolPick(i)}
                    className={cn(
                      "rounded-xl py-3 text-center transition",
                      i === volIdx ? "neon-border text-accent" : "card text-fg-muted hover:text-fg",
                    )}
                  >
                    <span className="block text-sm font-bold">{v.label}</span>
                    <span className="block font-mono text-[10px] opacity-70">{money(Math.round(product.price * v.mult))}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* color swatches */}
          {!isPerfume && colorOptions.length > 0 && (
            <div className="mt-7">
              <div className="mb-2.5 flex items-center justify-between">
                <p className="font-mono text-xs uppercase tracking-wider text-fg-muted">{t("prod.color")}</p>
                <span className="font-mono text-xs text-accent">{color}</span>
              </div>
              <div className="flex flex-wrap gap-3">
                {colorOptions.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColorPick(c)}
                    aria-label={c}
                    className={cn(
                      "grid h-11 w-11 place-items-center rounded-full transition",
                      c === color ? "neon-border scale-105" : "ring-1 ring-[var(--panel-border)] hover:scale-105",
                    )}
                  >
                    <span className="h-7 w-7 rounded-full" style={{ background: colorHex(c) }} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* quantity + CTAs */}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <div className="card flex items-center gap-1 rounded-xl p-1">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, Math.min(maxAdd, q) - 1))}
                disabled={clampedQty <= 1 || soldOut}
                className="grid h-9 w-9 place-items-center rounded-lg transition hover:bg-accent/10 disabled:opacity-40"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-9 text-center text-sm font-bold tabular-nums">{clampedQty}</span>
              <button
                type="button"
                onClick={() => setQty(() => Math.min(maxAdd, clampedQty + 1))}
                disabled={clampedQty >= maxAdd || soldOut}
                className="grid h-9 w-9 place-items-center rounded-lg transition hover:bg-accent/10 disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <motion.button
              type="button"
              onClick={addToCart}
              disabled={soldOut}
              whileTap={soldOut ? undefined : { scale: 0.97 }}
              className={cn(
                "flex h-12 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition",
                soldOut
                  ? "cursor-not-allowed border border-[var(--panel-border)] text-fg-muted opacity-60"
                  : inCartQty > 0
                    ? "border border-success/60 bg-success/15 text-success"
                    : "neon-border text-accent hover:bg-accent/10",
              )}
            >
              {inCartQty > 0 ? <Check className="h-4.5 w-4.5" /> : <ShoppingBag className="h-4.5 w-4.5" />}
              {soldOut ? t("common.soldOut") : inCartQty > 0 ? `${t("prod.inCart")} · ${inCartQty}` : t("common.addToCart")}
            </motion.button>

            <button
              type="button"
              onClick={() => toggleRaw(product.id)}
              aria-label={t("common.toggleFav")}
              className="card grid h-12 w-12 place-items-center rounded-xl transition hover:scale-105"
            >
              <Heart className={cn("h-5 w-5 transition", fav ? "fill-danger text-danger" : "text-fg-muted")} />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-3">
            <motion.button
              type="button"
              onClick={buyNow}
              disabled={soldOut}
              whileTap={soldOut ? undefined : { scale: 0.97 }}
              className={cn(
                "flex h-12 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold transition",
                soldOut
                  ? "cursor-not-allowed bg-[var(--panel)] text-fg-muted opacity-60"
                  : "bg-gradient-to-r from-accent to-accent-2 text-black shadow-[0_14px_40px_-12px_var(--accent-glow)] hover:brightness-110",
              )}
            >
              <Zap className="h-4.5 w-4.5" /> {t("prod.buyNow")}
            </motion.button>
            <button
              type="button"
              onClick={messageSeller}
              className="glass flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-medium transition hover:neon-border"
            >
              <MessageCircle className="h-4.5 w-4.5" /> {t("prod.messageSeller")}
            </button>
          </div>

          {/* trust strip */}
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            {[
              { icon: ShieldCheck, label: t("prod.authentic") },
              { icon: Truck, label: t("prod.tjDelivery") },
              { icon: Package, label: t("prod.securePack") },
            ].map((trust) => (
              <div key={trust.label} className="card flex flex-col items-center gap-1 rounded-xl py-3">
                <trust.icon className="h-4 w-4 text-accent" />
                <span className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">{trust.label}</span>
              </div>
            ))}
          </div>

          {/* seller card */}
          <SellerCard seller={seller} hasSeller={Boolean(product.sellerId)} />

          {/* description */}
          {(description || product.desc) && (
            <div className="mt-6">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-fg-muted">{t("prod.description")}</h2>
              {description ? (
                <div
                  className="rich-editor text-sm leading-relaxed text-fg/90"
                  dangerouslySetInnerHTML={{ __html: description }}
                />
              ) : (
                <p className="text-sm leading-relaxed text-fg/90">{product.desc}</p>
              )}
            </div>
          )}

          {/* accordions */}
          <div className="mt-6 flex flex-col gap-2.5">
            <Accordion title={t("prod.techSpecs")} defaultOpen>
              <SpecList product={product} variant={variantLabel} remaining={remaining} />
            </Accordion>
            <Accordion title={isPerfume ? t("prod.ingredients") : t("prod.materials")}>
              <p className="text-sm leading-relaxed text-fg-muted">{materialsCopy(t, product.type, product.tags)}</p>
            </Accordion>
            <Accordion title={t("prod.shippingTj")}>
              <ShippingTable />
            </Accordion>
          </div>
        </div>
      </div>

      {/* reviews */}
      <ProductReviews productId={product.id} />

      {/* recommendations */}
      <Recommendations all={allProducts} current={product} />
    </div>
  );
}

// ---------------------------------------------------------------------------
function SellerCard({ seller, hasSeller }: { seller: MiniProfile | null; hasSeller: boolean }) {
  const { t } = useT();
  if (!hasSeller) {
    return (
      <div className="card mt-6 flex items-center gap-3 rounded-2xl p-4">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-accent/40 to-accent-2/40 font-bold">
          O
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold">OASIS LUX</span>
            <VerifiedBadge className="h-4 w-4" />
          </div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">{t("prod.officialStore")}</p>
        </div>
      </div>
    );
  }
  if (!seller) {
    return <div className="card mt-6 h-[76px] animate-pulse rounded-2xl" />;
  }
  return (
    <Link
      href={`/profile/${seller.id}`}
      className="card mt-6 flex items-center gap-3 rounded-2xl p-4 transition hover:neon-border"
    >
      <Avatar src={seller.avatarUrl} name={seller.username} size={44} />
      <div className="flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold">{seller.fullName || `@${seller.username}`}</span>
          {seller.isVerified && <VerifiedBadge className="h-3.5 w-3.5" />}
          <PlanBadge plan={seller.plan} />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">{t("prod.sellerViewProfile")}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-fg-muted" />
    </Link>
  );
}

function Accordion({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left text-sm font-semibold transition hover:text-accent"
      >
        {title}
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180 text-accent")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SpecRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--panel-border)] py-2 text-sm last:border-0">
      <span className="text-fg-muted">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}

function SpecList({ product, variant, remaining }: { product: PD; variant?: string; remaining: number }) {
  const { t } = useT();
  return (
    <div>
      <SpecRow k={t("prod.brand")} v={product.brand} />
      <SpecRow k={t("prod.category")} v={product.type} />
      {variant && <SpecRow k={product.type === "perfume" ? t("prod.volume") : t("prod.color")} v={variant} />}
      {product.size && <SpecRow k={t("prod.size")} v={product.size} />}
      <SpecRow k={t("prod.condition")} v={t(CONDITION_KEY[product.condition ?? "new"])} />
      <SpecRow k={t("prod.availability")} v={remaining > 0 ? `${remaining} ${t("prod.inStockN")}` : t("common.outOfStock")} />
      {product.tags && product.tags.length > 0 && <SpecRow k={t("prod.tags")} v={product.tags.join(", ")} />}
    </div>
  );
}

function materialsCopy(t: (k: string) => string, type: ProductType, tags?: string[]): string {
  const base =
    type === "perfume"
      ? t("prod.matPerfume")
      : type === "watch"
        ? t("prod.matWatch")
        : t("prod.matGlasses");
  return tags && tags.length ? `${base} ${t("prod.categorisedUnder")}: ${tags.join(", ")}.` : base;
}

function ShippingTable() {
  const { t } = useT();
  return (
    <div>
      <p className="mb-3 text-sm text-fg-muted">
        {t("prod.shippingIntro")}
      </p>
      <div>
        {TJ.cities.map((c, i) => {
          const days = i === 0 ? t("prod.sameDay") : i < 3 ? t("prod.days12") : t("prod.days24");
          const fee = i === 0 ? "15 смн" : i < 3 ? "25 смн" : "40 смн";
          return <SpecRow key={c.name} k={c.name} v={`${days} · ${fee}`} />;
        })}
      </div>
    </div>
  );
}

function Recommendations({ all, current }: { all: DemoProduct[]; current: PD }) {
  const { t } = useT();
  const recs = useMemo(() => {
    const others = all.filter((p) => p.id !== current.id);
    const sameType = others.filter((p) => p.type === current.type);
    const rest = others.filter((p) => p.type !== current.type).sort((a, b) => b.rating - a.rating);
    const seen = new Set<string>();
    return [...sameType, ...rest].filter((p) => !seen.has(p.id) && seen.add(p.id)).slice(0, 12);
  }, [all, current.id, current.type]);

  if (recs.length === 0) return null;

  return (
    <section className="mt-14">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold sm:text-2xl">{t("prod.alsoLike")}</h2>
        <Link
          href={`/catalog?cat=${current.type}`}
          className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.2em] text-accent transition hover:underline"
        >
          {t("common.viewAll")} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <Swiper
        modules={[FreeMode, Mousewheel]}
        freeMode
        grabCursor
        mousewheel={{ forceToAxis: true }}
        slidesPerView={1.3}
        spaceBetween={14}
        breakpoints={{ 640: { slidesPerView: 2.3 }, 1024: { slidesPerView: 3.2 }, 1280: { slidesPerView: 4 } }}
        className="oasis-swiper"
      >
        {recs.map((p) => (
          <SwiperSlide key={p.id}>
            <ProductCard product={p} />
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}

// ---------------------------------------------------------------------------
function DetailSkeleton() {
  return (
    <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2 lg:gap-12">
      <div className="aspect-square w-full animate-pulse rounded-3xl bg-[var(--panel-border)]" />
      <div className="flex flex-col gap-4">
        <div className="h-3 w-24 animate-pulse rounded bg-[var(--panel-border)]" />
        <div className="h-9 w-2/3 animate-pulse rounded bg-[var(--panel-border)]" />
        <div className="h-6 w-32 animate-pulse rounded bg-[var(--panel-border)]" />
        <div className="mt-2 h-10 w-40 animate-pulse rounded bg-[var(--panel-border)]" />
        <div className="mt-4 h-12 w-full animate-pulse rounded-xl bg-[var(--panel-border)]" />
        <div className="h-12 w-full animate-pulse rounded-xl bg-[var(--panel-border)]" />
      </div>
    </div>
  );
}

function NotFound() {
  const { t } = useT();
  return (
    <div className="mx-auto grid min-h-[50vh] max-w-md place-items-center text-center">
      <div>
        <p className="text-2xl font-black">{t("prod.notFound")}</p>
        <p className="mt-2 text-sm text-fg-muted">{t("prod.notFoundHint")}</p>
        <Link
          href="/catalog"
          className="neon-border mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-accent transition hover:bg-accent/10"
        >
          {t("common.browseCatalog")} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
