"use client";

import { DashboardShell } from "@/components/app/DashboardShell";
import { GreetingBanner } from "./GreetingBanner";
import { StatTiles } from "./StatTiles";
import { FeaturedHero } from "./FeaturedHero";
import { FeaturedCarousel } from "./FeaturedCarousel";
import { TopSellers } from "./TopSellers";
import { BentoShowcase } from "./BentoShowcase";
import { LiveTracker } from "./LiveTracker";
import { SimilarToCart } from "./SimilarToCart";
import { BrowseSection } from "./BrowseSection";
import { ProductRow } from "./ProductRow";
import { InfiniteFeed } from "./InfiniteFeed";
import { useLiveProducts } from "@/hooks/useLiveProducts";
import { useT } from "@/hooks/useT";
import type { Profile } from "@/types";

export function HomeDashboard({ profile }: { profile: Profile }) {
  const { t } = useT();
  const { products, live } = useLiveProducts();
  // a user's freshly published items lead the trending/recent rows
  const trending = [...live, ...products.filter((p) => !p.isLive && p.rating >= 4.7)].slice(0, 8);
  const drops = products.filter((p) => p.discount);
  const recent = [...live, ...products.filter((p) => !p.isLive)].slice(0, 7);

  return (
    <DashboardShell profile={profile}>
      <GreetingBanner profile={profile} />
      <StatTiles profile={profile} />

      {/* editorial magazine hero — big tile + two stacked tiles, copy over art */}
      <FeaturedHero />

      {/* obviously-swipeable rails */}
      <ProductRow id="trending" title={t("home.trending")} products={trending} showVariants />
      <TopSellers />

      {/* fade-carousel banner for exclusive drops (a different swiper style) */}
      <FeaturedCarousel />

      {/* instagram-style asymmetric mosaic */}
      <BentoShowcase />

      <LiveTracker />

      {/* personalised recommendations from cart / favorites */}
      <SimilarToCart />

      <ProductRow id="drops" title={t("home.drops")} products={drops} showVariants />
      <BrowseSection />
      <ProductRow id="recent" title={t("home.recent")} products={recent} />

      {/* endless feed keeps the page YouTube-long & alive */}
      <InfiniteFeed />
    </DashboardShell>
  );
}
