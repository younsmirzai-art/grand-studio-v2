import type { Model } from "@/lib/polyhaven/client";
import { toSketchfabCatalogId } from "@/lib/catalog/ids";

const BASE_URL = "https://api.sketchfab.com/v3";

/** Public search only returns about this many downloadable hits. */
export const SKETCHFAB_DOWNLOADABLE_CAP = 10_000;

export interface SketchfabModel {
  uid: string;
  name: string;
  author: string;
  thumbnailUrl: string | null;
  vertexCount: number;
  faceCount: number;
  viewCount: number;
  likeCount: number;
  license: string;
  url: string;
  embedUrl: string;
  isDownloadable: boolean;
  categories: string[];
  tags: string[];
}

export const SKETCHFAB_CATEGORIES: Array<{ slug: string; name: string }> = [
  { slug: "animals-pets", name: "Animals & Pets" },
  { slug: "architecture", name: "Architecture" },
  { slug: "art-abstract", name: "Art & Abstract" },
  { slug: "cars-vehicles", name: "Cars & Vehicles" },
  { slug: "characters-creatures", name: "Characters" },
  { slug: "cultural-heritage-history", name: "Heritage" },
  { slug: "electronics-gadgets", name: "Electronics" },
  { slug: "fashion-style", name: "Fashion" },
  { slug: "food-drink", name: "Food & Drink" },
  { slug: "furniture-home", name: "Furniture" },
  { slug: "music", name: "Music" },
  { slug: "nature-plants", name: "Nature" },
  { slug: "people", name: "People" },
  { slug: "places-travel", name: "Places" },
  { slug: "science-technology", name: "Science" },
  { slug: "sports-fitness", name: "Sports" },
  { slug: "weapons-military", name: "Weapons" },
];

const PH_CATEGORY_TO_SKETCHFAB: Record<string, string> = {
  furniture: "furniture-home",
  nature: "nature-plants",
  plants: "nature-plants",
  vehicles: "cars-vehicles",
  architecture: "architecture",
  props: "furniture-home",
  characters: "characters-creatures",
  weapons: "weapons-military",
  food: "food-drink",
  electronics: "electronics-gadgets",
  animals: "animals-pets",
  people: "people",
};

export function mapCategoryToSketchfab(slug: string): string | null {
  if (SKETCHFAB_CATEGORIES.some((item) => item.slug === slug)) return slug;
  return PH_CATEGORY_TO_SKETCHFAB[slug.toLowerCase()] ?? null;
}

interface SketchfabApiModel {
  uid: string;
  name: string;
  user?: { displayName?: string };
  thumbnails?: { images?: Array<{ url: string; width?: number }> };
  vertexCount?: number;
  faceCount?: number;
  viewCount?: number;
  likeCount?: number;
  license?: { label?: string };
  isDownloadable?: boolean;
  embedUrl?: string;
  viewerUrl?: string;
  categories?: Array<{ name?: string; slug?: string }>;
  tags?: Array<{ name?: string; slug?: string }>;
}

function pickThumbnail(images: Array<{ url: string; width?: number }> | undefined): string | null {
  if (!images || images.length === 0) return null;
  const ranked = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  const mid = ranked.find((img) => (img.width ?? 0) >= 512) ?? ranked[ranked.length - 1];
  return mid?.url ?? null;
}

function mapApiModel(raw: SketchfabApiModel): SketchfabModel {
  return {
    uid: raw.uid,
    name: raw.name,
    author: raw.user?.displayName ?? "Unknown",
    thumbnailUrl: pickThumbnail(raw.thumbnails?.images),
    vertexCount: raw.vertexCount ?? 0,
    faceCount: raw.faceCount ?? 0,
    viewCount: raw.viewCount ?? 0,
    likeCount: raw.likeCount ?? 0,
    license: raw.license?.label ?? "Unknown",
    url: raw.viewerUrl ?? `https://sketchfab.com/3d-models/${raw.uid}`,
    embedUrl: raw.embedUrl ?? `https://sketchfab.com/models/${raw.uid}/embed`,
    isDownloadable: Boolean(raw.isDownloadable),
    categories: (raw.categories ?? [])
      .map((item) => item.slug || item.name || "")
      .filter(Boolean),
    tags: (raw.tags ?? []).map((item) => item.slug || item.name || "").filter(Boolean),
  };
}

export function sketchfabToModel(model: SketchfabModel): Model {
  return {
    id: toSketchfabCatalogId(model.uid),
    name: model.name,
    thumbnail: model.thumbnailUrl || "/placeholder.png",
    source: "Sketchfab",
    downloads: model.viewCount,
    isFree: model.isDownloadable,
    categories: model.categories,
    tags: model.tags,
    kind: "model",
  };
}

function sketchfabHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Token ${token}`;
  return headers;
}

export async function listSketchfabModels(options: {
  query?: string;
  categories?: string[];
  cursor?: number;
  count?: number;
  sortBy?: string;
  downloadable?: boolean;
  token?: string;
}): Promise<{ models: SketchfabModel[]; nextCursor: number | null }> {
  const count = Math.min(24, Math.max(1, options.count ?? 24));
  const cursor = Math.max(0, options.cursor ?? 0);
  const params = new URLSearchParams();
  params.set("type", "models");
  params.set("count", String(count));
  if (cursor > 0) params.set("cursor", String(cursor));
  if (options.query?.trim()) params.set("q", options.query.trim());
  if (options.downloadable !== false) params.set("downloadable", "true");
  if (options.sortBy) params.set("sort_by", options.sortBy);
  const category = options.categories?.find((item) => mapCategoryToSketchfab(item));
  const mapped = category ? mapCategoryToSketchfab(category) : null;
  if (mapped) params.set("categories", mapped);

  const res = await fetch(`${BASE_URL}/search?${params.toString()}`, {
    headers: sketchfabHeaders(options.token),
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Sketchfab API error: ${res.status}`);
  const data = (await res.json()) as {
    results?: SketchfabApiModel[];
    cursors?: { next?: string | null };
  };
  const models = (data.results ?? []).map(mapApiModel);
  const nextRaw = data.cursors?.next;
  const nextCursor =
    nextRaw !== undefined && nextRaw !== null && nextRaw !== ""
      ? Number.parseInt(String(nextRaw), 10)
      : null;
  return {
    models,
    nextCursor: Number.isFinite(nextCursor) ? nextCursor : null,
  };
}

export async function searchModels(
  query: string,
  options: { count?: number; token?: string; sortBy?: string } = {}
): Promise<SketchfabModel[]> {
  const page = await listSketchfabModels({
    query,
    count: options.count ?? 12,
    token: options.token,
    sortBy: options.sortBy,
  });
  return page.models;
}

export async function getSketchfabModel(
  uid: string,
  token?: string
): Promise<SketchfabModel | null> {
  const res = await fetch(`${BASE_URL}/models/${encodeURIComponent(uid)}`, {
    headers: sketchfabHeaders(token),
    next: { revalidate: 600 },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as SketchfabApiModel;
  if (!data?.uid) return null;
  return mapApiModel(data);
}

export type SketchfabDownloadPick = {
  url: string;
  sizeBytes: number | null;
  fileNameHint: string;
};

/** Prefer source archive (often ZIP) when Sketchfab provides it, then GLB/GLTF. */
export async function getSketchfabDownloadPick(
  uid: string,
  token: string
): Promise<SketchfabDownloadPick | null> {
  const res = await fetch(`${BASE_URL}/models/${uid}/download`, {
    headers: { Authorization: `Token ${token}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, unknown>;
  const source = data.source as { url?: string; size?: number } | undefined;
  const glb = data.glb as { url?: string; size?: number } | undefined;
  const gltf = data.gltf as { url?: string; size?: number } | undefined;

  let url: string | null = null;
  let sizeBytes: number | null = null;
  let ext = "bin";

  if (source?.url) {
    url = source.url;
    sizeBytes = typeof source.size === "number" ? source.size : null;
    const p = url.split("?")[0].toLowerCase();
    if (p.endsWith(".zip")) ext = "zip";
    else if (p.endsWith(".glb")) ext = "glb";
  } else if (glb?.url) {
    url = glb.url;
    sizeBytes = typeof glb.size === "number" ? glb.size : null;
    ext = "glb";
  } else if (gltf?.url) {
    url = gltf.url;
    sizeBytes = typeof gltf.size === "number" ? gltf.size : null;
    ext = "gltf";
  }

  if (!url) return null;
  return { url, sizeBytes, fileNameHint: `${uid}.${ext}` };
}

export async function getDownloadUrl(uid: string, token: string): Promise<string | null> {
  const pick = await getSketchfabDownloadPick(uid, token);
  return pick?.url ?? null;
}
