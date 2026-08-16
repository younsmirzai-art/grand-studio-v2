import {
  getPolyHavenAssetInfo,
  getPolyHavenAssetFiles,
  getThumbnailUrl,
  listPolyHavenPackageDownloads,
  pickPolyHavenFormatEntry,
  type CatalogFileOption,
  type PolyHavenAssetInfo,
  type PolyHavenFiles,
} from "@/lib/polyhaven/client";
import { getAmbientCgAsset } from "@/lib/ambientcg/client";
import { getSketchfabModel } from "@/lib/sketchfab/client";
import { parseCatalogId } from "@/lib/catalog/ids";

export interface CatalogDetail {
  id: string;
  rawId: string;
  source: "polyhaven" | "sketchfab" | "ambientcg";
  name: string;
  kind: "model" | "texture" | "hdri";
  thumbnail: string;
  categories: string[];
  tags: string[];
  description?: string;
  author?: string;
  downloads: number;
  license: string;
  embedUrl?: string;
  previewModelUrl?: string;
  files?: PolyHavenFiles | null;
  polyhavenInfo?: PolyHavenAssetInfo | null;
  extraDownloads: CatalogFileOption[];
}

export async function getCatalogDetail(
  rawId: string
): Promise<CatalogDetail | null> {
  const parsed = parseCatalogId(rawId);

  if (parsed.source === "sketchfab") {
    const token = process.env.SKETCHFAB_API_TOKEN?.trim();
    const model = await getSketchfabModel(parsed.id, token);
    if (!model) return null;
    return {
      id: rawId,
      rawId: parsed.id,
      source: "sketchfab",
      name: model.name,
      kind: "model",
      thumbnail: model.thumbnailUrl || "",
      categories: model.categories,
      tags: model.tags,
      author: model.author,
      downloads: model.viewCount,
      license: model.license,
      embedUrl: model.embedUrl,
      extraDownloads: [],
    };
  }

  if (parsed.source === "ambientcg") {
    const asset = await getAmbientCgAsset(parsed.id);
    if (!asset) return null;
    const kind =
      asset.dataType === "HDRI"
        ? "hdri"
        : asset.dataType === "3DModel"
          ? "model"
          : "texture";
    return {
      id: rawId,
      rawId: parsed.id,
      source: "ambientcg",
      name: asset.name,
      kind,
      thumbnail: asset.thumbnail,
      categories: asset.category ? [asset.category] : [],
      tags: asset.tags,
      description: asset.description || undefined,
      downloads: asset.downloads,
      license: "CC0",
      extraDownloads: asset.downloadOptions.map((item) => ({
        key: item.key,
        label: item.label,
        description: "CC0 PBR package",
        url: item.url,
        size: item.size,
      })),
    };
  }

  const [info, files] = await Promise.all([
    getPolyHavenAssetInfo(parsed.id),
    getPolyHavenAssetFiles(parsed.id),
  ]);
  if (!info) return null;

  const kind =
    info.type === 0 ? "hdri" : info.type === 1 ? "texture" : "model";
  const hasGltf = pickPolyHavenFormatEntry(files, "gltf", "1k") !== null;
  const extra =
    kind === "model" ? [] : listPolyHavenPackageDownloads(files);

  return {
    id: rawId,
    rawId: parsed.id,
    source: "polyhaven",
    name: info.name,
    kind,
    thumbnail: getThumbnailUrl(parsed.id, 1200),
    categories: info.categories,
    tags: info.tags,
    description: info.description,
    downloads: info.download_count,
    license: "CC0",
    previewModelUrl: hasGltf
      ? `/api/polyhaven/gltf-preview/${encodeURIComponent(parsed.id)}`
      : undefined,
    files,
    polyhavenInfo: info,
    extraDownloads: extra,
  };
}
