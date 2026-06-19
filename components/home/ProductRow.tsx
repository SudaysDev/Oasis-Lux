"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperClass } from "swiper";
import { FreeMode, Mousewheel, Scrollbar } from "swiper/modules";
import "swiper/css";
import "swiper/css/scrollbar";
import { ArrowRight, ChevronLeft, ChevronRight, MoveHorizontal } from "lucide-react";
import { ProductCard, ProductCardSkeleton } from "@/components/shop/ProductCard";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import type { DemoProduct } from "@/lib/landing-data";

type Props = {
  id: string;
  title: string;
  products: DemoProduct[];
  showVariants?: boolean;
  href?: string;
  /** Pad a short list up to this many slides (with rotation) so the rail stays long & swipeable. */
  minRail?: number;
};

/**
 * Rail card sizing — comfortable, full-size cards (NOT shrunk). The "lots of stuff" feeling
 * comes from rails that never end (endless swipe), not from cramming in tiny cards.
 * Shared with the interstitial rails in the infinite feed.
 */
export const RAIL_SLIDES_PER_VIEW = 1.25;
export const RAIL_SPACE_BETWEEN = 14;
export const RAIL_BREAKPOINTS = {
  640: { slidesPerView: 2.3 },
  1024: { slidesPerView: 3.2 },
  1280: { slidesPerView: 4.2 },
};

/** Repeat a short list (rotating the start each cycle) so a rail never ends after 2 swipes. */
function lengthen<T>(list: T[], min: number): T[] {
  if (list.length === 0 || list.length >= min) return list;
  const out: T[] = [];
  for (let k = 0; out.length < min; k++) {
    const offset = (k * 3) % list.length;
    for (let i = 0; i < list.length && out.length < min; i++) out.push(list[(i + offset) % list.length]!);
  }
  return out;
}

/** Hard ceiling on a single rail's slides so endless cycling never blows up the DOM. */
const RAIL_MAX = 96;

export function ProductRow({ id, title, products, showVariants, href = "/catalog", minRail = 22 }: Props) {
  const { t } = useT();
  const [swiper, setSwiper] = useState<SwiperClass | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  // grows each time the user swipes to the end → the rail keeps producing more cards (endless)
  const [cap, setCap] = useState(minRail);

  // Simulated fetch so skeleton loaders genuinely show on first paint.
  const { data, isLoading } = useQuery({
    queryKey: ["home-row", id],
    queryFn: () => new Promise<DemoProduct[]>((resolve) => setTimeout(() => resolve(products), 700)),
  });

  const list = useMemo(() => lengthen(data ?? [], cap), [data, cap]);

  const growIfNeeded = () => setCap((c) => Math.min(RAIL_MAX, c + minRail));

  // recalc Swiper geometry after a batch is appended so the new cards become swipeable
  useEffect(() => {
    swiper?.update();
  }, [swiper, list.length]);

  const sync = (sw: SwiperClass) => {
    setAtStart(sw.isBeginning);
    setAtEnd(sw.isEnd);
  };

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold sm:text-xl">{title}</h2>
          {/* drag hint — visually states "this is swipeable" */}
          <span className="swipe-hint hidden items-center gap-1 rounded-full border border-[var(--panel-border)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-fg-muted sm:inline-flex">
            <MoveHorizontal className="h-3 w-3" />
            {t("home.swipe")}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* nav arrows — only on >= sm where dragging is less obvious */}
          <div className="hidden items-center gap-1.5 sm:flex">
            <button
              type="button"
              aria-label={t("home.prev")}
              onClick={() => swiper?.slidePrev()}
              className={cn("rail-arrow h-9 w-9", atStart && "is-disabled")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={t("home.next")}
              onClick={() => swiper?.slideNext()}
              className={cn("rail-arrow h-9 w-9", atEnd && "is-disabled")}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <Link
            href={href}
            className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.2em] text-accent transition hover:underline"
          >
            {t("common.viewAll")} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="rail" data-at-start={atStart} data-at-end={atEnd}>
        <Swiper
          modules={[FreeMode, Mousewheel, Scrollbar]}
          freeMode
          grabCursor
          mousewheel={{ forceToAxis: true }}
          scrollbar={{ draggable: true, hide: false }}
          slidesPerView={RAIL_SLIDES_PER_VIEW}
          spaceBetween={RAIL_SPACE_BETWEEN}
          breakpoints={RAIL_BREAKPOINTS}
          onSwiper={(sw) => {
            setSwiper(sw);
            sync(sw);
          }}
          onSlideChange={sync}
          onReachBeginning={() => setAtStart(true)}
          onReachEnd={() => {
            setAtEnd(true);
            growIfNeeded(); // append another batch so swiping never hits a dead end
          }}
          onFromEdge={sync}
          onSetTranslate={sync}
          className="oasis-swiper !pb-7"
        >
          {(isLoading ? Array.from({ length: 8 }) : list).map((p, i) => (
            <SwiperSlide key={isLoading ? `s-${i}` : `${(p as DemoProduct).id}-${i}`} className="!h-auto">
              {isLoading ? <ProductCardSkeleton /> : <ProductCard product={p as DemoProduct} showVariants={showVariants} />}
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}
