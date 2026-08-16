import { Download, Layers, User } from "lucide-react";

interface ModelMetadataProps {
  downloads: number;
  license: string;
  source: string;
  author?: string;
  kind: "model" | "texture" | "hdri";
}

const KIND_LABEL: Record<ModelMetadataProps["kind"], string> = {
  model: "3D model",
  texture: "Texture",
  hdri: "HDRI",
};

const SOURCE_LABEL: Record<string, string> = {
  polyhaven: "Poly Haven",
  sketchfab: "Sketchfab",
  ambientcg: "ambientCG",
};

export function ModelMetadata({
  downloads,
  license,
  source,
  author,
  kind,
}: ModelMetadataProps) {
  const authorInitial = author?.charAt(0).toUpperCase() ?? "?";

  return (
    <div className="gs-card p-5">
      <h3 className="font-semibold text-white text-sm mb-1">Details</h3>
      <p className="text-xs text-white/40 mb-4">Asset specifications</p>

      <div>
        <div className="gs-metadata-row">
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-white/40" />
            <span className="gs-metadata-label">Type</span>
          </div>
          <span className="gs-metadata-value">{KIND_LABEL[kind]}</span>
        </div>

        <div className="gs-metadata-row">
          <div className="flex items-center gap-2">
            <Download className="w-3.5 h-3.5 text-white/40" />
            <span className="gs-metadata-label">Downloads</span>
          </div>
          <span className="gs-metadata-value">{downloads.toLocaleString()}</span>
        </div>

        {author ? (
          <div className="gs-metadata-row">
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-white/40" />
              <span className="gs-metadata-label">Author</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="gs-author-avatar" aria-hidden>
                {authorInitial}
              </span>
              <span className="gs-metadata-value">{author}</span>
            </div>
          </div>
        ) : null}

        <div className="gs-metadata-row">
          <span className="gs-metadata-label">License</span>
          <span className="gs-metadata-value flex items-center gap-1.5 justify-end">
            <span className="text-green-400">●</span>
            {license}
          </span>
        </div>

        <div className="gs-metadata-row">
          <span className="gs-metadata-label">Source</span>
          <span className="gs-metadata-value">
            {SOURCE_LABEL[source] ?? source}
          </span>
        </div>
      </div>
    </div>
  );
}
