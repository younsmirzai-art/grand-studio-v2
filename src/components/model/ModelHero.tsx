import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ModelActions } from "./ModelActions";

interface ModelHeroProps {
  name: string;
  modelId: string;
  modelThumbnail?: string;
  categories: string[];
  tags: string[];
}

export function ModelHero({
  name,
  modelId,
  modelThumbnail,
  categories,
  tags,
}: ModelHeroProps) {
  const primaryCategory = categories[0];

  return (
    <div className="mb-6">
      <Link
        href="/browse"
        className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to browse
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          {primaryCategory && (
            <Link
              href={`/browse?categories=${encodeURIComponent(primaryCategory)}`}
              className="inline-block text-xs text-[#A5B4FC] hover:text-white transition uppercase tracking-wider font-medium mb-2"
            >
              {primaryCategory}
            </Link>
          )}

          <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight mb-3">
            {name}
          </h1>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.slice(0, 8).map((tag) => (
                <Link
                  key={tag}
                  href={`/browse?q=${encodeURIComponent(tag)}`}
                  className="gs-tag"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          )}
        </div>

        <ModelActions
          name={name}
          modelId={modelId}
          modelThumbnail={modelThumbnail}
        />
      </div>
    </div>
  );
}
