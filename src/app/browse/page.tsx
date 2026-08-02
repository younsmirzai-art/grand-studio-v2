import { Suspense } from "react";
import type { Metadata } from "next";
import { getPolyHavenCategories } from "@/lib/polyhaven/client";
import { SearchInput } from "@/components/browse/SearchInput";
import { SortDropdown } from "@/components/browse/SortDropdown";
import { FilterPanel } from "@/components/browse/FilterPanel";
import { ActiveFilters } from "@/components/browse/ActiveFilters";
import { InfiniteGrid } from "@/components/browse/InfiniteGrid";
import { MobileFilterDrawer } from "@/components/browse/MobileFilterDrawer";

export const metadata: Metadata = {
  title: "Browse 3D Models",
  description:
    "Search 500K+ 3D models from Poly Haven, Sketchfab, and more. Filter by category, source, license, and format.",
};

export default async function BrowsePage() {
  const categories = await getPolyHavenCategories("models");
  const categoryLabels = Object.fromEntries(
    categories.map((c) => [c.slug, c.name])
  );

  return (
    <div className="pt-24 pb-16 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="mb-6 md:mb-8">
          <div className="gs-eyebrow gs-eyebrow-cyan inline-flex mb-3">
            <span>Marketplace</span>
          </div>
          <h1 className="gs-heading-lg mb-2">Browse models</h1>
          <p className="text-white/55">
            Discover 3D models from every marketplace, all in one place
          </p>
        </div>

        <Suspense fallback={<ToolbarSkeleton />}>
          <div className="flex gap-3 mb-4 flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <SearchInput />
            </div>
            <MobileFilterDrawer categories={categories} />
            <SortDropdown />
          </div>

          <ActiveFilters categoryLabels={categoryLabels} />

          <div className="flex gap-6">
            <div className="hidden lg:block">
              <FilterPanel categories={categories} />
            </div>
            <div className="flex-1 min-w-0">
              <InfiniteGrid />
            </div>
          </div>
        </Suspense>
      </div>
    </div>
  );
}

function ToolbarSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-10 rounded-lg bg-white/5 animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="aspect-square rounded-xl bg-white/5 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
