import Link from "next/link";
import { getPolyHavenAssets } from "@/lib/polyhaven/client";
import { ModelCard } from "./ModelCard";
import { ArrowRight } from "lucide-react";

export async function FeaturedModels() {
  const models = await getPolyHavenAssets({
    type: "models",
    limit: 8,
  });

  if (models.length === 0) {
    return null;
  }

  return (
    <section className="gs-section">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-end justify-between mb-12">
          <div>
            <span className="gs-section-label">Handpicked</span>
            <h2 className="text-3xl md:text-5xl font-display font-bold tracking-tight">
              Featured Models
            </h2>
          </div>
          <Link
            href="/browse"
            className="hidden md:inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition group"
          >
            View all
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {models.map((model, i) => (
            <ModelCard key={model.id} model={model} index={i} />
          ))}
        </div>

        <div className="md:hidden mt-8 text-center">
          <Link
            href="/browse"
            className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition"
          >
            View all models
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
