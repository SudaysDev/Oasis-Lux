import { ParticleField } from "@/components/fx/ParticleField";
import { LandingNav } from "@/components/landing/LandingNav";
import { Hero } from "@/components/landing/Hero";
import { Marquee } from "@/components/landing/Marquee";
import { StatsSection } from "@/components/landing/StatsSection";
import { CategoriesSection } from "@/components/landing/CategoriesSection";
import { ShowcaseSection } from "@/components/landing/ShowcaseSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { PricingSection } from "@/components/landing/PricingSection";
import { CoverageMap } from "@/components/landing/CoverageMap";
import { CtaSection } from "@/components/landing/CtaSection";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { BRANDS } from "@/lib/landing-data";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-bg text-fg">
      {/* persistent interactive particle field (cursor-attract) behind the whole page */}
      <ParticleField className="pointer-events-none fixed inset-0 z-0" quantity={50} />

      <div className="relative z-10">
        <LandingNav />
        <main>
          <Hero />
          <div className="border-y border-[var(--panel-border)] py-5">
            <Marquee items={BRANDS} duration={34} />
          </div>
          <StatsSection />
          <CategoriesSection />
          <ShowcaseSection />
          <FeaturesSection />
          <HowItWorks />
          <PricingSection />
          <CoverageMap />
          <CtaSection />
        </main>
        <LandingFooter />
      </div>
    </div>
  );
}
