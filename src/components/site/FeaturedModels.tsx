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
    <section className="gs-section-pro">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-end justify-between mb-12">
          <div>
            <div className="gs-eyebrow gs-eyebrow-cyan inline-flex mb-4">
              <span>Handpicked</span>
            </div>
            <h2 className="gs-heading-lg">Featured models</h2>
          </div>
          <Link
            href="/browse"
            className="hidden md:inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition group"
          >
            View all
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
