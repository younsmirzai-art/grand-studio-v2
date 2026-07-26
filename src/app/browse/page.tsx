import type { Metadata } from "next";
import Link from "next/link";
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
    <div className="pt-32 pb-24 min-h-screen">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-12">
          <h1 className="text-3xl md:text-5xl font-display font-bold mb-3">
            {q ? `Results for "${q}"` : "Browse Models"}
          </h1>
          <p className="text-white/60">
            {models.length} {models.length === 1 ? "model" : "models"} found
          </p>
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
                      : "gs-glass text-white/70 hover:text-white"
                  }`}
                >
                  {cat.name}
                </Link>
              );
            })}
          </div>
        </div>

        {models.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {models.map((model, i) => (
              <ModelCard key={model.id} model={model} index={i} />
            ))}
          </div>
        ) : (
          <div className="py-24 text-center gs-card p-12 max-w-md mx-auto">
            <p className="text-white/60 mb-2 font-medium">No models found</p>
            <p className="text-white/40 text-sm">
              {q ? "Try a different search term" : "Try a different category"}
            </p>
            {(q || category) && (
              <Link
                href="/browse"
                className="inline-block mt-6 text-sm text-cyan-400 hover:text-cyan-300 transition"
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
