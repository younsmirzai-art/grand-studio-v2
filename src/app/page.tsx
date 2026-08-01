import { Suspense } from "react";
import { Hero } from "@/components/site/Hero";
import { SourcesBar } from "@/components/site/SourcesBar";
import { FeatureGrid } from "@/components/site/FeatureGrid";
import { HowItWorks } from "@/components/site/HowItWorks";
import { FeaturedModels } from "@/components/site/FeaturedModels";
import { PluginSection } from "@/components/site/PluginSection";
import { PricingSection } from "@/components/site/PricingSection";
import { FinalCTA } from "@/components/site/FinalCTA";

export default function HomePage() {
  return (
    <>
      <Hero />
      <SourcesBar />
      <FeatureGrid />
      <HowItWorks />
      <Suspense
        fallback={
          <div className="gs-section-pro text-center text-white/40 text-sm">
            Loading featured models...
          </div>
        }
      >
        <FeaturedModels />
      </Suspense>
      <PluginSection />
      <PricingSection />
      <FinalCTA />
    </>
  );
}
