import type { Model } from "@/lib/polyhaven/client";
import { toAmbientCgCatalogId } from "@/lib/catalog/ids";

const BASE_URL = "https://ambientcg.com/api/v2/full_json";

export interface AmbientCgDownload {
  key: string;
  label: string;
  url: string;
  size: number;
}

export interface AmbientCgAsset {
  assetId: string;
  name: string;
  dataType: "Material" | "HDRI" | "3DModel" | string;
  category: string;
  tags: string[];
  thumbnail: string;
  downloads: number;
  description: string;
  downloadOptions: AmbientCgDownload[];
}

interface AmbientCgRawAsset {
  assetId: string;
  displayName?: string;
  dataType?: string;
  displayCategory?: string;
  tags?: string[];
  downloadCount?: number;
  description?: string;
  previewImage?: Record<string, string>;
  downloadFolders?: {
    default?: {
      downloadFiletypeCategories?: {
        zip?: {
          downloads?: Array<{
            downloadLink?: string;
            fileName?: string;
            size?: number;
            attribute?: string;
          }>;
        };
      };
    };
  };
}

function mapKind(dataType: string | undefined): Model["kind"] {
  if (dataType === "HDRI") return "hdri";
  if (dataType === "3DModel") return "model";
  return "texture";
}

function pickPreview(preview?: Record<string, string>): string {
  return (
    preview?.["512-JPG-242424"] ||
    preview?.["512-PNG"] ||
    preview?.["256-JPG-242424"] ||
    preview?.["256-PNG"] ||
    Object.values(preview ?? {})[0] ||
    ""
  );
}

function mapDownloads(raw: AmbientCgRawAsset): AmbientCgDownload[] {
  const files =
    raw.downloadFolders?.default?.downloadFiletypeCategories?.zip?.downloads ??
    [];
  return files.slice(0, 8).map((file) => ({
    key: file.attribute || file.fileName || "zip",
    label: file.attribute || file.fileName || "ZIP",
    url: file.downloadLink || "",
    size: file.size ?? 0,
  })).filter((file) => file.url.length > 0);
}

function mapAsset(raw: AmbientCgRawAsset): AmbientCgAsset {
  return {
    assetId: raw.assetId,
    name: raw.displayName || raw.assetId,
    dataType: raw.dataType || "Material",
    category: raw.displayCategory || "Material",
    tags: raw.tags ?? [],
    thumbnail: pickPreview(raw.previewImage),
    downloads: raw.downloadCount ?? 0,
    description: raw.description || "",
    downloadOptions: mapDownloads(raw),
  };
}

export function ambientCgToModel(asset: AmbientCgAsset): Model {
  return {
    id: toAmbientCgCatalogId(asset.assetId),
    name: asset.name,
    thumbnail: asset.thumbnail,
    source: "ambientCG",
    downloads: asset.downloads,
    isFree: true,
    categories: asset.category ? [asset.category.toLowerCase()] : [],
    tags: asset.tags,
    kind: mapKind(asset.dataType),
  };
}

export async function listAmbientCgAssets(options: {
  query?: string;
  type?: "Material" | "HDRI" | "3DModel" | "Material,HDRI";
  offset?: number;
  limit?: number;
  includeDownloads?: boolean;
}): Promise<{ assets: AmbientCgAsset[]; total: number }> {
  const limit = Math.min(48, Math.max(1, options.limit ?? 12));
  const offset = Math.max(0, options.offset ?? 0);
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  params.set("sort", "Popular");
  params.set("type", options.type ?? "Material,HDRI");
  params.set(
    "include",
    options.includeDownloads
      ? "previewData,labelData,statisticsData,downloadData"
      : "previewData,labelData,statisticsData"
  );
  if (options.query?.trim()) params.set("q", options.query.trim());

  const res = await fetch(`${BASE_URL}?${params.toString()}`, {
    next: { revalidate: 600 },
  });
  if (!res.ok) throw new Error(`ambientCG API error: ${res.status}`);
  const data = (await res.json()) as {
    numberOfResults?: number;
    foundAssets?: AmbientCgRawAsset[];
  };
  return {
    assets: (data.foundAssets ?? []).map(mapAsset),
    total: data.numberOfResults ?? 0,
  };
}

export async function getAmbientCgAsset(
  assetId: string
): Promise<AmbientCgAsset | null> {
  const params = new URLSearchParams();
  params.set("id", assetId);
  params.set("include", "previewData,labelData,statisticsData,downloadData");
  const res = await fetch(`${BASE_URL}?${params.toString()}`, {
    next: { revalidate: 600 },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { foundAssets?: AmbientCgRawAsset[] };
  const raw = data.foundAssets?.[0];
  if (!raw) return null;
  return mapAsset(raw);
}
