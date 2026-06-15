"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperClass } from "swiper";
import { FreeMode, Mousewheel, Scrollbar } from "swiper/modules";
import "swiper/css";
import "swiper/css/scrollbar";
import { BadgeCheck, ChevronLeft, ChevronRight, MoveHorizontal, Star, Store } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";
import { fetchTopSellers, type SellerCard } from "@/lib/data/products";
import { BRANDS } from "@/lib/landing-data";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";

type Seller = {
  key: string;
  href: string;
  name: string;
  handle: string;
  avatarUrl?: string;
  hue: number;
  rating: number;
  items: number;
  verified: boolean;
  official?: boolean;
};

// Curated brand boutiques so the rail always feels alive even before real
// sellers exist. Deterministic stats keep server/client render identical.
const CURATED: Seller[] = BRANDS.slice(0, 10).map((b, i) => ({
  key: `brand-${b}`,
  href: `/catalog?brand=${encodeURIComponent(b)}`,
  name: `${b.charAt(0)}${b.slice(1).toLowerCase()} Boutique`,
  handle: b.toLowerCase().replace(/\s+/g, ""),
  hue: (i * 47) % 360,
  rating: 4.6 + ((i * 7) % 4) / 10,
  items: 12 + ((i * 13) % 40),
  verified: i % 3 === 0,
  official: true,
}));

export function TopSellers() {
  const { t } = useT();
  const [real, setReal] = useState<Seller[]>([]);
  const [swiper, setSwiper] = useState<SwiperClass | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchTopSellers(getBrowserClient(), 12).then((rows: SellerCard[]) => {
      if (cancelled) return;
      setReal(
        rows.map((s, i) => ({
          key: `seller-${s.id}`,
          href: `/profile/${s.id}`,
          name: s.fullName || `@${s.username}`,
          handle: s.username,
          avatarUrl: s.avatarUrl,
          hue: (i * 53) % 360,
          rating: Number(s.avgRating.toFixed(1)) || 5,
          items: s.itemCount,
          verified: s.isVerified,
        })),
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // real sellers lead, curated boutiques fill the rest (de-duped by handle)
  const sellers: Seller[] = [...real, ...CURATED.filter((c) => !real.some((r) => r.handle === c.handle))].slice(0, 16);

  const sync = (sw: SwiperClass) => {
    setAtStart(sw.isBeginning);
    setAtEnd(sw.isEnd);
  };

  return (
    <section className="mt-12">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="flex items-center gap-2 text-lg font-bold sm:text-xl">
            <Store className="h-5 w-5 text-accent" />
            {t("home.topSellers")}
          </h2>
          <span className="swipe-hint hidden items-center gap-1 rounded-full border border-[var(--panel-border)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-fg-muted sm:inline-flex">
            <MoveHorizontal className="h-3 w-3" />
            {t("home.swipe")}
          </span>
        </div>
        <div className="hidden items-center gap-1.5 sm:flex">
          <button type="button" aria-label={t("home.prev")} onClick={() => swiper?.slidePrev()} className={cn("rail-arrow h-9 w-9", atStart && "is-disabled")}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" aria-label={t("home.next")} onClick={() => swiper?.slideNext()} className={cn("rail-arrow h-9 w-9", atEnd && "is-disabled")}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="rail" data-at-start={atStart} data-at-end={atEnd}>
        <Swiper
          modules={[FreeMode, Mousewheel, Scrollbar]}
          freeMode
          grabCursor
          mousewheel={{ forceToAxis: true }}
          scrollbar={{ draggable: true, hide: false }}
          slidesPerView={2.2}
          spaceBetween={14}
          breakpoints={{ 640: { slidesPerView: 3.3 }, 1024: { slidesPerView: 4.4 }, 1280: { slidesPerView: 5.4 } }}
          onSwiper={(sw) => {
            setSwiper(sw);
            sync(sw);
          }}
          onSlideChange={sync}
          onReachBeginning={() => setAtStart(true)}
          onReachEnd={() => setAtEnd(true)}
          onFromEdge={sync}
          onSetTranslate={sync}
          className="oasis-swiper !pb-7"
        >
          {sellers.map((s) => (
            <SwiperSlide key={s.key} className="!h-auto">
              <Link
                href={s.href}
                className="card group flex h-full flex-col items-center gap-2 rounded-2xl p-4 text-center transition hover:border-accent hover:shadow-[0_18px_44px_-20px_var(--accent-glow)]"
              >
                {/* gradient avatar ring — clearly a "story"-style circle */}
                <div
                  className="grid h-16 w-16 place-items-center rounded-full p-[2px] transition-transform group-hover:scale-105"
                  style={{ background: `conic-gradient(from 180deg, hsl(${s.hue} 90% 60%), hsl(${(s.hue + 120) % 360} 90% 60%), hsl(${s.hue} 90% 60%))` }}
                >
                  <div className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-bg-elev">
                    {s.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.avatarUrl} alt={s.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xl font-black text-fg">{s.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <span className="line-clamp-1 text-sm font-semibold">{s.name}</span>
                  {s.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-accent" />}
                </div>
                <span className="line-clamp-1 font-mono text-[10px] text-fg-muted">@{s.handle}</span>

                <div className="mt-1 flex items-center gap-3 text-[11px] text-fg-muted">
                  <span className="flex items-center gap-0.5">
                    <Star className="h-3 w-3 fill-accent text-accent" />
                    {s.rating.toFixed(1)}
                  </span>
                  <span>· {s.items} {t("home.items")}</span>
                </div>

                <span className="mt-2 w-full rounded-full border border-[var(--panel-border)] py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-accent transition group-hover:neon-border">
                  {t("home.visitStore")}
                </span>
              </Link>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}
