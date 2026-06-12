"use client";

import { DashboardShell } from "@/components/app/DashboardShell";
import { GreetingBanner } from "./GreetingBanner";
import { StatTiles } from "./StatTiles";
import { FeaturedCarousel } from "./FeaturedCarousel";
import { LiveTracker } from "./LiveTracker";
import { BrowseSection } from "./BrowseSection";
import { ProductRow } from "./ProductRow";
import { useLiveProducts } from "@/hooks/useLiveProducts";
import type { Profile } from "@/types";

export function HomeDashboard({ profile }: { profile: Profile }) {
  const { products, live } = useLiveProducts();
  // a user's freshly published items lead the trending/recent rows
  const trending = [...live, ...products.filter((p) => !p.isLive && p.rating >= 4.7)].slice(0, 8);
  const drops = products.filter((p) => p.discount);
  const recent = [...live, ...products.filter((p) => !p.isLive)].slice(0, 7);

  return (
    <DashboardShell profile={profile}>
      <GreetingBanner profile={profile} />
      <StatTiles profile={profile} />
      <FeaturedCarousel />
      <LiveTracker />
      <BrowseSection />
      <ProductRow id="trending" title="Trending now" products={trending} showVariants />
      <ProductRow id="drops" title="Exclusive drops" products={drops} showVariants />
      <ProductRow id="recent" title="Recently viewed" products={recent} />
    </DashboardShell>
  );
}
