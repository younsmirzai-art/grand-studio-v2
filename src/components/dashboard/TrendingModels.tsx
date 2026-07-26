import Link from "next/link";
import { getPolyHavenAssets } from "@/lib/polyhaven/client";
import { ModelCard } from "@/components/site/ModelCard";
import { TrendingUp } from "lucide-react";

export async function TrendingModels() {
  // Offset past the recommended set so the two sections don't look identical.
  const all = await getPolyHavenAssets({ limit: 12, type: "models" });
  const models = all.slice(4, 8);

  if (models.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-purple-400" />
          <h3 className="font-semibold text-sm text-white">
            Trending this week
          </h3>
        </div>
        <Link
          href="/browse"
          className="text-xs text-white/50 hover:text-white transition"
        >
          See more →
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
