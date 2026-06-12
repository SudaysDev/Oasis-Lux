"use client";

import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import "swiper/css";
import { ProductCard } from "@/components/shop/ProductCard";
import { SectionHeader } from "./SectionHeader";
import { DEMO_PRODUCTS } from "@/lib/landing-data";

export function ShowcaseSection() {
  return (
    <section id="showcase" className="relative scroll-mt-20 py-20">
      <div className="mx-auto mb-12 flex max-w-7xl flex-wrap items-end justify-between gap-4 px-6 sm:px-10">
        <SectionHeader eyebrow="Hand-picked" title="Trending drops" />
        <Link
          href="/catalog"
          className="glass rounded-full px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] transition hover:neon-border"
        >
          View all
        </Link>
      </div>

      <Swiper
        modules={[Autoplay]}
        loop
        speed={6000}
        grabCursor
        slidesPerView={1.2}
        spaceBetween={16}
        autoplay={{ delay: 0, disableOnInteraction: false, pauseOnMouseEnter: true }}
        breakpoints={{
          640: { slidesPerView: 2.2 },
          1024: { slidesPerView: 3.4 },
          1280: { slidesPerView: 4.2 },
        }}
        className="oasis-swiper px-6 pb-2 sm:px-10"
      >
        {DEMO_PRODUCTS.map((p) => (
          <SwiperSlide key={p.id}>
            <ProductCard product={p} requireAuth />
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}
