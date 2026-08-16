import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { browseCatalog, type CatalogKind } from "@/lib/catalog/browse";
import { ModelCard } from "@/components/site/ModelCard";

interface SimilarModelsProps {
  currentId: string;
  categories: string[];
  kind?: "model" | "texture" | "hdri";
}

function kindToCatalog(kind?: SimilarModelsProps["kind"]): CatalogKind {
  switch (kind) {
    case "texture":
      return "textures";
    case "hdri":
      return "hdris";
    case "model":
      return "models";
    default:
      return "all";
  }
}

export async function SimilarModels({
  currentId,
  categories,
  kind,
}: SimilarModelsProps) {
  const result = await browseCatalog({
    categories: categories.slice(0, 1),
    kind: kindToCatalog(kind),
    sort: "popular",
    limit: 8,
    offset: 0,
  });
  const models = result.models.filter((item) => item.id !== currentId).slice(0, 4);

  if (models.length === 0) return null;

  const browseHref = categories[0]
    ? `/browse?categories=${encodeURIComponent(categories[0])}`
    : "/browse";

  return (
    <section className="mt-12">
      <div className="flex items-center justify-between mb-4 gap-4">
        <div>
          <h2 className="font-display font-semibold text-xl text-white">
            Similar assets
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
