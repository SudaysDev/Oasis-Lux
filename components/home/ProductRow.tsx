"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Swiper, SwiperSlide } from "swiper/react";
import { FreeMode, Mousewheel } from "swiper/modules";
import "swiper/css";
import { ArrowRight } from "lucide-react";
import { ProductCard, ProductCardSkeleton } from "@/components/shop/ProductCard";
import { useT } from "@/hooks/useT";
import type { DemoProduct } from "@/lib/landing-data";

type Props = {
  id: string;
  title: string;
  products: DemoProduct[];
  showVariants?: boolean;
  href?: string;
};

export function ProductRow({ id, title, products, showVariants, href = "/catalog" }: Props) {
  const { t } = useT();
  // Simulated fetch so skeleton loaders genuinely show on first paint.
  const { data, isLoading } = useQuery({
    queryKey: ["home-row", id],
    queryFn: () => new Promise<DemoProduct[]>((resolve) => setTimeout(() => resolve(products), 700)),
  });

  const list = data ?? [];

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold sm:text-xl">{title}</h2>
        <Link
          href={href}
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
        {(isLoading ? Array.from({ length: 5 }) : list).map((p, i) => (
          <SwiperSlide key={isLoading ? `s-${i}` : (p as DemoProduct).id}>
            {isLoading ? <ProductCardSkeleton /> : <ProductCard product={p as DemoProduct} showVariants={showVariants} />}
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}
