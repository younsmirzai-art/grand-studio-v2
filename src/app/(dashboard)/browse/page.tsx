import { Suspense } from "react";
import type { Metadata } from "next";
import { getPolyHavenCategories } from "@/lib/polyhaven/client";
import { SKETCHFAB_CATEGORIES } from "@/lib/sketchfab/client";
import { SearchInput } from "@/components/browse/SearchInput";
import { SortDropdown } from "@/components/browse/SortDropdown";
import { FilterPanel } from "@/components/browse/FilterPanel";
import { ActiveFilters } from "@/components/browse/ActiveFilters";
import { InfiniteGrid } from "@/components/browse/InfiniteGrid";
import { MobileFilterDrawer } from "@/components/browse/MobileFilterDrawer";
import { BrowseCategoryPills } from "@/components/browse/BrowseCategoryPills";
import { BrowseTypePills } from "@/components/browse/BrowseTypePills";

export const metadata: Metadata = {
  title: "Browse 3D Models",
  description:
    "Search downloadable 3D models, textures, and HDRIs from Sketchfab, Poly Haven, and ambientCG.",
};

export default async function BrowsePage() {
  const polyCategories = await getPolyHavenCategories("models");
  const categories = [
    ...SKETCHFAB_CATEGORIES.map((item) => ({
      slug: item.slug,
      name: item.name,
      count: 0,
    })),
    ...polyCategories.filter(
      (item) => !SKETCHFAB_CATEGORIES.some((sf) => sf.slug === item.slug)
    ),
  ];
  const categoryLabels = Object.fromEntries(
    categories.map((c) => [c.slug, c.name])
  );

  return (
    <div className="min-h-[calc(100vh-3.5rem)] px-4 lg:px-5 py-4">
      <div className="mb-4">
        <h1 className="text-2xl md:text-3xl font-display font-semibold tracking-tight text-slate-100">
          Browse assets
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Models from Sketchfab, plus Poly Haven and ambientCG textures and
          HDRIs — in one hall.
        </p>
      </div>

      <Suspense fallback={<ToolbarSkeleton />}>
        <div className="sticky top-14 z-20 mb-4 rounded-2xl border border-white/10 bg-[#090D16]/85 backdrop-blur-xl p-3 space-y-3">
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <SearchInput />
            </div>
            <MobileFilterDrawer categories={categories} />
            <SortDropdown />
          </div>
          <BrowseTypePills />
          <BrowseCategoryPills categories={categories} />
        </div>

        <ActiveFilters categoryLabels={categoryLabels} />

        <div className="flex gap-5">
          <div className="hidden lg:block">
            <FilterPanel categories={categories} />
          </div>
          <div className="flex-1 min-w-0">
            <InfiniteGrid />
          </div>
        </div>
      </Suspense>
    </div>
  );
}

function ToolbarSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-10 rounded-lg bg-white/5 animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        {Array.from({ length: 18 }, (_, i) => (
          <div
            key={i}
            className="aspect-square rounded-xl bg-white/5 animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
