"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BadgePercent, ChevronLeft, ChevronRight, Crown, Flame, Gem, Glasses, Loader2, MoveHorizontal, PackageCheck, Percent, PiggyBank, Rocket, Sparkles, SprayCan, Star, Store, Tag, Wallet, Watch, type LucideIcon } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperClass } from "swiper";
import { FreeMode, Mousewheel, Scrollbar } from "swiper/modules";
import "swiper/css";
import "swiper/css/scrollbar";
import { ProductCard, ProductCardSkeleton } from "@/components/shop/ProductCard";
import { RAIL_BREAKPOINTS, RAIL_SLIDES_PER_VIEW, RAIL_SPACE_BETWEEN } from "./ProductRow";
import { useLiveProducts } from "@/hooks/useLiveProducts";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import type { DemoProduct } from "@/lib/landing-data";

type Filter = { key: string; label: string; icon: LucideIcon };

const STATIC_FILTERS: Filter[] = [
  { key: "all", label: "For you", icon: Sparkles },
  { key: "popular", label: "Popular", icon: Flame },
  { key: "topRated", label: "Top rated", icon: Star },
  { key: "inStock", label: "In stock", icon: PackageCheck },
  { key: "deals", label: "Deals", icon: BadgePercent },
  { key: "bigDeals", label: "Big discounts", icon: Percent },
  { key: "premium", label: "Premium", icon: Crown },
  { key: "luxury", label: "Luxury", icon: Gem },
  { key: "mid", label: "Mid-range", icon: Wallet },
  { key: "cheap", label: "Under 100", icon: Tag },
  { key: "under50", label: "Under 50", icon: PiggyBank },
  { key: "perfume", label: "Perfumes", icon: SprayCan },
  { key: "watch", label: "Watches", icon: Watch },
  { key: "glasses", label: "Eyewear", icon: Glasses },
  { key: "new", label: "Fresh drops", icon: Rocket },
];

function matches(p: DemoProduct, f: string): boolean {
  if (f.startsWith("brand:")) return p.brand?.toLowerCase() === f.slice(6).toLowerCase();
  switch (f) {
    case "all": return true;
    case "popular": return p.rating >= 4.7;
    case "topRated": return p.rating >= 4.5;
    case "inStock": return p.stock > 0;
    case "deals": return Boolean(p.discount);
    case "bigDeals": return (p.discount ?? 0) >= 30;
    case "premium": return p.price >= 500;
    case "luxury": return p.price >= 300;
    case "mid": return p.price >= 100 && p.price < 300;
    case "cheap": return p.price < 100;
    case "under50": return p.price < 50;
    case "new": return Boolean(p.isLive);
    case "perfume": case "watch": case "glasses": return p.type === f;
    default: return true;
  }
}

const BATCH = 18;
const MAX = 180; // generous cap so the page feels endless without unbounded DOM

// comfortable full-size cards (not shrunk) — same density as the rest of the app
const FEED_GRID = "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4";
// YouTube-Shorts rhythm: drop a horizontal swiper shelf into the feed every N cards
const RAIL_EVERY = 12;

// fallback localized titles when there aren't enough distinct brands to label a shelf
const RAIL_TITLE_KEYS = ["home.trending", "home.recForYou", "home.drops", "home.spotlight", "home.handpicked", "home.topSellers", "home.recent"] as const;

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
  const [filter, setFilter] = useState<string>("all");
  const { t } = useT();
  const railRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => products.filter((p) => matches(p, filter)), [products, filter]);

  // dynamic brand chips (top brands in the feed) → YouTube-style endless filter bar
  const allFilters = useMemo<Filter[]>(() => {
    const count = new Map<string, number>();
    for (const p of products) if (p.brand) count.set(p.brand, (count.get(p.brand) ?? 0) + 1);
    const brands: Filter[] = [...count.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 16)
      .map(([b]) => ({ key: `brand:${b}`, label: b, icon: Store }));
    return [...STATIC_FILTERS, ...brands];
  }, [products]);

  const scrollRail = (dir: 1 | -1) => railRef.current?.scrollBy({ left: dir * 260, behavior: "smooth" });

  return (
    <section className="mt-12">
      <div className="mb-3 flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/50" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
        </span>
        <h2 className="text-lg font-bold sm:text-xl">{t("home.recommended")}</h2>
      </div>

      {/* YouTube-style scrollable filter chips */}
      <div className="group relative mb-5">
        <button
          type="button"
          aria-label="Scroll left"
          onClick={() => scrollRail(-1)}
          className="absolute -left-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-[var(--panel-border)] bg-bg-elev p-1.5 shadow-lg transition hover:text-accent group-hover:block"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div ref={railRef} className="no-scrollbar flex gap-2 overflow-x-auto scroll-smooth px-0.5 py-0.5">
          {allFilters.map((f) => {
            const Icon = f.icon;
            const on = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
                  on ? "bg-accent text-on-accent" : "glass text-fg-muted hover:text-fg",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {f.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => scrollRail(1)}
          className="absolute -right-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-[var(--panel-border)] bg-bg-elev p-1.5 shadow-lg transition hover:text-accent group-hover:block"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {loading && products.length === 0 ? (
        <div className={FEED_GRID}>
          {Array.from({ length: 12 }).map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-fg-muted">{t("home.nothingFilter")}</p>
      ) : (
        <FeedGrid key={filter} base={filtered} />
      )}
    </section>
  );
}

// cycle a (reshuffled) base up to n cards so a shelf can be swiped endlessly without running dry
function railItems(base: DemoProduct[], seed: number, n: number): DemoProduct[] {
  const ordered = seededOrder(base, seed);
  if (ordered.length === 0) return [];
  return Array.from({ length: n }, (_, i) => ordered[i % ordered.length]!);
}

function FeedGrid({ base }: { base: DemoProduct[] }) {
  const { t } = useT();
  const [count, setCount] = useState(BATCH);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const feed = useMemo(() => buildFeed(base, count), [base, count]);
  const done = count >= MAX;

  // split the vertical feed into chunks so a horizontal swiper shelf can slot between them
  const groups = useMemo(() => {
    const out: { p: DemoProduct; key: string }[][] = [];
    for (let i = 0; i < feed.length; i += RAIL_EVERY) out.push(feed.slice(i, i + RAIL_EVERY));
    return out;
  }, [feed]);

  // brands with enough stock to fill a shelf → each interstitial gets its OWN title & products
  // (so shelves read like distinct YouTube shelves, never the same heading copied over and over)
  const brands = useMemo(() => {
    const tally = new Map<string, number>();
    for (const p of base) if (p.brand) tally.set(p.brand, (tally.get(p.brand) ?? 0) + 1);
    return [...tally.entries()].filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1]).map(([b]) => b);
  }, [base]);

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
      {groups.map((group, gi) => {
        const idx = gi - 1; // 0-based shelf index (shelves sit *between* chunks)
        const brand = gi > 0 && brands.length ? brands[idx % brands.length]! : null;
        const shelfBase = brand ? base.filter((p) => p.brand === brand) : base;
        const shelfTitle = brand ?? t(RAIL_TITLE_KEYS[idx % RAIL_TITLE_KEYS.length]!);
        return (
          <Fragment key={gi}>
            {gi > 0 && <FeedRail title={shelfTitle} base={shelfBase} seed={gi * 7 + 1} />}
            <div className={FEED_GRID}>
              {group.map(({ p, key }, i) => (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "0px 0px -40px 0px" }}
                  transition={{ duration: 0.3, delay: (i % RAIL_EVERY) * 0.02 }}
                >
                  <ProductCard product={p} />
                </motion.div>
              ))}
            </div>
          </Fragment>
        );
      })}

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

const RAIL_START = 18; // shelf slides on first paint
const RAIL_STEP = 18; // appended each time the shelf is swiped to the end
const RAIL_CAP = 120; // ceiling so an endless shelf still can't blow up the DOM

/** A horizontal swiper shelf dropped between grid chunks — endless: swiping to the end loads more. */
function FeedRail({ title, base, seed }: { title: string; base: DemoProduct[]; seed: number }) {
  const { t } = useT();
  const [cap, setCap] = useState(RAIL_START);
  const [swiper, setSwiper] = useState<SwiperClass | null>(null);
  const items = useMemo(() => railItems(base, seed, cap), [base, seed, cap]);

  // recalc geometry after a batch is appended so the freshly added cards become swipeable
  useEffect(() => {
    swiper?.update();
  }, [swiper, items.length]);

  if (items.length === 0) return null;
  return (
    <section className="my-4">
      <div className="mb-3 flex items-center gap-2">
        <MoveHorizontal className="h-4 w-4 text-accent" />
        <h3 className="text-base font-bold sm:text-lg">{title}</h3>
        <span className="swipe-hint hidden items-center gap-1 rounded-full border border-[var(--panel-border)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-fg-muted sm:inline-flex">
          {t("home.swipe")}
        </span>
      </div>
      <div className="rail">
        <Swiper
          modules={[FreeMode, Mousewheel, Scrollbar]}
          freeMode
          grabCursor
          mousewheel={{ forceToAxis: true }}
          scrollbar={{ draggable: true, hide: false }}
          slidesPerView={RAIL_SLIDES_PER_VIEW}
          spaceBetween={RAIL_SPACE_BETWEEN}
          breakpoints={RAIL_BREAKPOINTS}
          onSwiper={setSwiper}
          onReachEnd={() => setCap((c) => Math.min(RAIL_CAP, c + RAIL_STEP))}
          className="oasis-swiper !pb-7"
        >
          {items.map((p, i) => (
            <SwiperSlide key={`${p.id}-${i}`} className="!h-auto">
              <ProductCard product={p} />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}
