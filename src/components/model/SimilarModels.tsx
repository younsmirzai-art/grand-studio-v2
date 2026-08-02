import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getSimilarModels } from "@/lib/polyhaven/client";
import { ModelCard } from "@/components/site/ModelCard";

interface SimilarModelsProps {
  currentId: string;
  categories: string[];
}

export async function SimilarModels({
  currentId,
  categories,
}: SimilarModelsProps) {
  const models = await getSimilarModels(currentId, categories, 4);

  if (models.length === 0) return null;

  const browseHref = categories[0]
    ? `/browse?categories=${encodeURIComponent(categories[0])}`
    : "/browse";

  return (
    <section className="mt-12">
      <div className="flex items-center justify-between mb-4 gap-4">
        <div>
          <h2 className="font-display font-semibold text-xl text-white">
            Similar models
          </h2>
          <p className="text-sm text-white/50 mt-1">
            You might also like these
          </p>
        </div>
        <Link
          href={browseHref}
          className="text-sm text-white/60 hover:text-white transition flex items-center gap-1 group shrink-0"
        >
          View more
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {models.map((model, i) => (
          <ModelCard key={model.id} model={model} index={i} />
        ))}
      </div>
    </section>
  );
}
