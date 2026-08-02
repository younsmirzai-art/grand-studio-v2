import { Download, Calendar, Ruler, Layers, User } from "lucide-react";
import type { PolyHavenAssetInfo } from "@/lib/polyhaven/client";

interface ModelMetadataProps {
  info: PolyHavenAssetInfo;
}

export function ModelMetadata({ info }: ModelMetadataProps) {
  const publishDate = new Date(info.date_published * 1000);
  const formattedDate = publishDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Poly Haven model dimensions are millimeters.
  const dimensions = info.dimensions
    ? `${(info.dimensions[0] / 1000).toFixed(2)} × ${(info.dimensions[1] / 1000).toFixed(2)} × ${(info.dimensions[2] / 1000).toFixed(2)} m`
    : null;

  const authorEntries = Object.entries(info.authors || {});
  const primaryAuthor = authorEntries[0]?.[0];
  const authorInitial = primaryAuthor?.charAt(0).toUpperCase() ?? "?";

  return (
    <div className="gs-card p-5">
      <h3 className="font-semibold text-white text-sm mb-1">Details</h3>
      <p className="text-xs text-white/40 mb-4">Model specifications</p>

      <div>
        <div className="gs-metadata-row">
          <div className="flex items-center gap-2">
            <Download className="w-3.5 h-3.5 text-white/40" />
            <span className="gs-metadata-label">Downloads</span>
          </div>
          <span className="gs-metadata-value">
            {info.download_count.toLocaleString()}
          </span>
        </div>

        <div className="gs-metadata-row">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-white/40" />
            <span className="gs-metadata-label">Published</span>
          </div>
          <span className="gs-metadata-value">{formattedDate}</span>
        </div>

        {primaryAuthor && (
          <div className="gs-metadata-row">
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-white/40" />
              <span className="gs-metadata-label">Author</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="gs-author-avatar" aria-hidden>
                {authorInitial}
              </span>
              <span className="gs-metadata-value">{primaryAuthor}</span>
            </div>
          </div>
        )}

        {dimensions && (
          <div className="gs-metadata-row">
            <div className="flex items-center gap-2">
              <Ruler className="w-3.5 h-3.5 text-white/40" />
              <span className="gs-metadata-label">Dimensions</span>
            </div>
            <span className="gs-metadata-value">{dimensions}</span>
          </div>
        )}

        {typeof info.polycount === "number" && info.polycount > 0 && (
          <div className="gs-metadata-row">
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-white/40" />
              <span className="gs-metadata-label">Polygons</span>
            </div>
            <span className="gs-metadata-value">
              {info.polycount.toLocaleString()}
            </span>
          </div>
        )}

        <div className="gs-metadata-row">
          <span className="gs-metadata-label">License</span>
          <span className="gs-metadata-value flex items-center gap-1.5 justify-end">
            <span className="text-green-400">●</span>
            CC0 (Public Domain)
          </span>
        </div>

        <div className="gs-metadata-row">
          <span className="gs-metadata-label">Source</span>
          <span className="gs-metadata-value">Poly Haven</span>
        </div>
      </div>
    </div>
  );
}
