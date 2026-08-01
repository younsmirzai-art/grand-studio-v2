import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { getPolyHavenAssets } from "@/lib/polyhaven/client";
import { ModelCard } from "@/components/site/ModelCard";

interface BrowsePageProps {
  searchParams: Promise<{ q?: string; category?: string }>;
}

const categories = [
  { name: "All", slug: "" },
  { name: "Nature", slug: "nature" },
  { name: "Architecture", slug: "architecture" },
  { name: "Vehicles", slug: "vehicles" },
  { name: "Characters", slug: "characters" },
  { name: "Sci-Fi", slug: "scifi" },
  { name: "Fantasy", slug: "fantasy" },
  { name: "Weapons", slug: "weapons" },
  { name: "Furniture", slug: "furniture" },
];

export const metadata: Metadata = {
  title: "Browse 3D Models",
  description:
    "Browse and download thousands of 3D models from Poly Haven and more.",
};

export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const params = await searchParams;
  const { q, category } = params;

  const models = await getPolyHavenAssets({
    type: "models",
    search: q,
    categories: category ? [category] : undefined,
    limit: 40,
  });

  return (
    <div className="pt-28 pb-24 min-h-screen">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="gs-eyebrow gs-eyebrow-cyan inline-flex mb-3">
              <span>Marketplace</span>
            </div>
            <h1 className="gs-heading-lg mb-2">
              {q ? `Results for “${q}”` : "Browse models"}
            </h1>
            <p className="text-white/55">
              {models.length} {models.length === 1 ? "model" : "models"} found
              {category ? ` in ${category}` : ""}
            </p>
          </div>

          <form action="/browse" method="GET" className="w-full lg:w-[380px]">
            {category ? (
              <input type="hidden" name="category" value={category} />
            ) : null}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
              <input
                type="text"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Search models..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-white/25"
              />
            </div>
          </form>
        </div>

        <div className="mb-8 -mx-6 px-6 overflow-x-auto">
          <div className="flex gap-2 pb-2 min-w-max">
            {categories.map((cat) => {
              const isActive =
                category === cat.slug || (!category && cat.slug === "");
              const href = cat.slug
                ? `/browse?category=${cat.slug}${q ? `&q=${encodeURIComponent(q)}` : ""}`
                : `/browse${q ? `?q=${encodeURIComponent(q)}` : ""}`;

              return (
                <Link
                  key={cat.slug || "all"}
                  href={href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? "bg-white text-black"
                      : "bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {cat.name}
                </Link>
              );
            })}
          </div>
        </div>

        {models.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {models.map((model, i) => (
              <ModelCard key={model.id} model={model} index={i} />
            ))}
          </div>
        ) : (
          <div className="py-20 text-center gs-feature-card max-w-md mx-auto">
            <p className="text-white/70 mb-2 font-medium">No models found</p>
            <p className="text-white/40 text-sm mb-6">
              {q ? "Try a different search term" : "Try a different category"}
            </p>
            {(q || category) && (
              <Link
                href="/browse"
                className="inline-flex text-sm text-cyan-400 hover:text-cyan-300 transition"
              >
                Clear filters →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
