import { Suspense } from "react";
import { Hero } from "@/components/site/Hero";
import { TrustedSources } from "@/components/site/TrustedSources";
import { FeaturedModels } from "@/components/site/FeaturedModels";
import { Categories } from "@/components/site/Categories";
import { PluginBanner } from "@/components/site/PluginBanner";
import { Stats } from "@/components/site/Stats";

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustedSources />
      <Suspense
        fallback={
          <div className="gs-section text-center text-white/40">
            Loading models...
          </div>
        }
      >
        <FeaturedModels />
      </Suspense>
      <Categories />
      <PluginBanner />
      <Stats />
    </>
  );
}
