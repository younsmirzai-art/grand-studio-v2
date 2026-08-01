import { Suspense } from "react";
import { Hero } from "@/components/site/Hero";
import { SourcesBar } from "@/components/site/SourcesBar";
import { FeatureGrid } from "@/components/site/FeatureGrid";
import { HowItWorks } from "@/components/site/HowItWorks";
import { FeaturedModels } from "@/components/site/FeaturedModels";
import { PluginSection } from "@/components/site/PluginSection";
import { PricingSection } from "@/components/site/PricingSection";
import { TrustStrip } from "@/components/site/TrustStrip";
import { FinalCTA } from "@/components/site/FinalCTA";

export default function HomePage() {
  return (
    <>
      <Suspense
        fallback={
          <section className="pt-28 pb-16 md:pt-36 md:pb-28">
            <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12">
              <div className="space-y-4">
                <div className="h-6 w-48 rounded-full bg-white/5 animate-pulse" />
                <div className="h-12 w-full max-w-md rounded-lg bg-white/5 animate-pulse" />
                <div className="h-20 w-full max-w-lg rounded-lg bg-white/5 animate-pulse" />
              </div>
              <div className="h-80 rounded-2xl bg-white/5 animate-pulse" />
            </div>
          </section>
        }
      >
        <Hero />
      </Suspense>
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
      <TrustStrip />
      <FinalCTA />
    </>
  );
}
