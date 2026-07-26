import Link from "next/link";
import { getPolyHavenAssets } from "@/lib/polyhaven/client";
import { ModelCard } from "@/components/site/ModelCard";
import { Sparkles } from "lucide-react";

export async function RecommendedModels() {
  const models = await getPolyHavenAssets({ limit: 4, type: "models" });

  if (models.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h3 className="font-semibold text-sm text-white">
            Recommended for you
          </h3>
        </div>
        <Link
          href="/browse"
          className="text-xs text-white/50 hover:text-white transition"
        >
          Browse all →
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {models.map((model, i) => (
          <ModelCard key={model.id} model={model} index={i} />
        ))}
      </div>
    </div>
  );
}
