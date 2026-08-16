const BASE_URL = "https://api.polyhaven.com";
const CDN_URL = "https://cdn.polyhaven.com";
const USER_AGENT = "GrandStudio/1.0 (contact@grandstudio.dev)";

export type PolyHavenAssetType = "models" | "textures" | "hdris";

export interface PolyHavenAsset {
  id: string;
  name: string;
  type: PolyHavenAssetType;
  categories: string[];
  tags: string[];
  downloadCount: number;
  datePublished: number;
  thumbnailUrl: string;
}

export interface PolyHavenDownloadLinks {
  [resolution: string]: {
    [format: string]: {
      url: string;
      size: number;
    };
  };
}

const assetCache = new Map<PolyHavenAssetType, { data: PolyHavenAsset[]; expires: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function phFetch(path: string) {
  const url = `${BASE_URL}${path}`;
  console.log("[Poly Haven] API call to", url);
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Poly Haven API error: ${res.status}`);
  const data = await res.json();
  console.log("[Poly Haven] Response data keys:", typeof data === "object" && data !== null ? Object.keys(data).slice(0, 10) : "n/a");
  return data;
}

function parseAssetList(raw: Record<string, { name?: string; categories?: string[]; tags?: string[]; download_count?: number; date_published?: number }>, type: PolyHavenAssetType): PolyHavenAsset[] {
  return Object.entries(raw).map(([id, data]) => ({
    id,
    name: data.name ?? id.replace(/_/g, " "),
    type,
    categories: data.categories ?? [],
    tags: data.tags ?? [],
    downloadCount: data.download_count ?? 0,
    datePublished: data.date_published ?? 0,
    thumbnailUrl: `${CDN_URL}/asset_img/thumbs/${id}.png?width=256`,
  }));
}

export async function getAssets(type: PolyHavenAssetType): Promise<PolyHavenAsset[]> {
  const cached = assetCache.get(type);
  if (cached && Date.now() < cached.expires) return cached.data;

  const raw = await phFetch(`/assets?t=${type}`);
  const assets = parseAssetList(raw, type);
  assetCache.set(type, { data: assets, expires: Date.now() + CACHE_TTL });
  return assets;
}

/** Split search into meaningful tokens (ignore very short noise). */
function tokenizeSearchQuery(query: string): string[] {
  return query
    .toLowerCase()
    .trim()
    .split(/[\s,;]+/)
    .map((t) => t.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ""))
    .filter((t) => t.length >= 2);
}

/** True if `token` appears as its own word (not inside "warehouse" for "house"). */
function hasWordBoundaryMatch(text: string, token: string): boolean {
  if (!token.length) return false;
  const esc = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:^|[^a-z0-9])${esc}(?:[^a-z0-9]|$)`, "i");
  return re.test(text);
}

function normalizeDisplayText(s: string): string {
  return s.toLowerCase().replace(/_/g, " ");
}

/**
 * Score how well an asset matches one token. Higher = more relevant.
 * Uses word boundaries so "house" does not match "warehouse"/"tree" spam from substring rules.
 */
function bestScoreForToken(a: PolyHavenAsset, token: string): number {
  let best = 0;
  const nameNorm = normalizeDisplayText(a.name);
  const idLower = a.id.toLowerCase();

  if (hasWordBoundaryMatch(nameNorm, token)) best = Math.max(best, 120);
  if (a.name.toLowerCase() === token) best = Math.max(best, 130);

  for (const seg of idLower.split("_").filter(Boolean)) {
    if (seg === token) best = Math.max(best, 115);
    else if (hasWordBoundaryMatch(seg, token)) best = Math.max(best, 95);
  }

  for (const c of a.categories) {
    const cl = c.toLowerCase();
    if (cl === token) best = Math.max(best, 110);
    else if (hasWordBoundaryMatch(cl, token)) best = Math.max(best, 85);
  }

  for (const t of a.tags) {
    const tl = t.toLowerCase();
    if (tl === token) best = Math.max(best, 105);
    else if (hasWordBoundaryMatch(tl, token)) best = Math.max(best, 80);
  }

  // Id begins with token as a slug segment (e.g. house_plant_01 for "house")
  if (idLower.startsWith(token + "_")) {
    best = Math.max(best, 50);
  }

  return best;
}

/**
 * Every token must match somewhere with score > 0. Score is sum of per-token bests + popularity tie-break prep.
 */
function rankAssetsForQuery(assets: PolyHavenAsset[], tokens: string[]): Array<{ asset: PolyHavenAsset; score: number }> {
  if (tokens.length === 0) return [];

  const ranked: Array<{ asset: PolyHavenAsset; score: number }> = [];
  for (const a of assets) {
    let sum = 0;
    let ok = true;
    for (const token of tokens) {
      const s = bestScoreForToken(a, token);
      if (s <= 0) {
        ok = false;
        break;
      }
      sum += s;
    }
    if (ok) ranked.push({ asset: a, score: sum });
  }

  ranked.sort((x, y) => {
    if (y.score !== x.score) return y.score - x.score;
    return y.asset.downloadCount - x.asset.downloadCount;
  });
  return ranked;
}

/** Legacy loose match when strict token search returns nothing (typos / unusual ids). */
function legacySubstringMatches(all: PolyHavenAsset[], q: string, count: number): PolyHavenAsset[] {
  const ql = q.toLowerCase().trim();
  if (!ql) return [];
  const matches = all.filter(
    (a) =>
      a.name.toLowerCase().includes(ql) ||
      a.id.toLowerCase().includes(ql) ||
      a.categories.some((c) => c.toLowerCase().includes(ql)) ||
      a.tags.some((t) => t.toLowerCase().includes(ql))
  );
  matches.sort((a, b) => b.downloadCount - a.downloadCount);
  return matches.slice(0, count);
}

export async function searchAssets(
  query: string,
  type: PolyHavenAssetType,
  count = 20
): Promise<PolyHavenAsset[]> {
  const all = await getAssets(type);
  const qTrim = query.trim();
  if (!qTrim) return [];

  const tokens = tokenizeSearchQuery(qTrim);
  const limit = Math.max(1, Math.min(50, count));

  if (tokens.length > 0) {
    const ranked = rankAssetsForQuery(all, tokens);
    if (ranked.length > 0) {
      return ranked.slice(0, limit).map((r) => r.asset);
    }
  }

  // Single very short query (e.g. "a") or no token parsed: treat whole string as one token if long enough
  const single = qTrim.toLowerCase();
  if (single.length >= 3) {
    const rankedOne = rankAssetsForQuery(all, [single]);
    if (rankedOne.length > 0) {
      return rankedOne.slice(0, limit).map((r) => r.asset);
    }
  }

  return legacySubstringMatches(all, qTrim, limit);
}

export async function getAssetInfo(assetId: string) {
  return phFetch(`/info/${assetId}`);
}

export async function getDownloadLinks(assetId: string): Promise<PolyHavenDownloadLinks> {
  return phFetch(`/files/${assetId}`);
}

export function getThumbnailUrl(assetId: string, width = 256): string {
  return `${CDN_URL}/asset_img/thumbs/${assetId}.png?width=${width}`;
}

/** Poly Haven models API exposes FBX (not GLB); textures are separate map entries. */
export type PolyHavenModelFormat = "fbx";

function resolutionFallbackOrder(preferred: string): string[] {
  const order = [preferred, "1k", "2k", "4k", "8k"];
  const seen = new Set<string>();
  return order.filter((r) => {
    if (seen.has(r)) return false;
    seen.add(r);
    return true;
  });
}

/**
 * Pick a direct mesh download URL from a Poly Haven /files/{id} JSON payload.
 * Reads the top-level `fbx` block only (models have no `glb` key on Poly Haven).
 */
export function pickPolyHavenModelFormatUrl(
  links: Record<string, unknown>,
  formatKey: PolyHavenModelFormat,
  resolution = "1k"
): string | null {
  const formatBlock = links[formatKey];
  if (!formatBlock || typeof formatBlock !== "object" || formatBlock === null) return null;
  const fb = formatBlock as Record<string, unknown>;
  for (const res of resolutionFallbackOrder(resolution)) {
    const resBlock = fb[res];
    if (!resBlock || typeof resBlock !== "object" || resBlock === null) continue;
    const rb = resBlock as Record<string, unknown>;
    if (formatKey === "fbx") {
      const fbxNested = rb.fbx;
      if (fbxNested && typeof fbxNested === "object" && fbxNested !== null && "url" in fbxNested) {
        const u = (fbxNested as { url?: unknown }).url;
        if (typeof u === "string" && u.length > 0) return u;
      }
    }
    const top = rb.url;
    if (typeof top === "string" && top.length > 0) return top;
    const nested = rb[formatKey];
    if (nested && typeof nested === "object" && nested !== null && "url" in nested) {
      const u = (nested as { url?: unknown }).url;
      if (typeof u === "string" && u.length > 0) return u;
    }
  }
  return null;
}

function polyHavenMeshUrlEndsWithFbx(url: string): boolean {
  const path = url.split("?")[0].split("#")[0].toLowerCase();
  return path.endsWith(".fbx");
}

/**
 * Diffuse color map for models: `files.Diffuse.{res}.{jpg|png|...}.url`
 */
export function pickPolyHavenDiffuseUrl(
  links: Record<string, unknown>,
  resolution = "1k"
): string | null {
  const diffuseRoot = links.Diffuse ?? links.diffuse;
  if (!diffuseRoot || typeof diffuseRoot !== "object" || diffuseRoot === null) return null;
  const dr = diffuseRoot as Record<string, unknown>;
  for (const res of resolutionFallbackOrder(resolution)) {
    const resBlock = dr[res];
    if (!resBlock || typeof resBlock !== "object" || resBlock === null) continue;
    const rb = resBlock as Record<string, unknown>;
    for (const fmt of ["jpg", "jpeg", "png", "webp", "exr"]) {
      const node = rb[fmt];
      if (node && typeof node === "object" && node !== null && "url" in node) {
        const u = (node as { url?: unknown }).url;
        if (typeof u === "string" && u.length > 0) return u;
      }
    }
    const top = rb.url;
    if (typeof top === "string" && top.length > 0) return top;
  }
  return null;
}

/** Poly Haven models: FBX URL plus optional Diffuse texture URL. */
export function resolvePolyHavenModelDownloadUrl(
  links: Record<string, unknown>,
  resolution = "1k"
): { url: string; format: PolyHavenModelFormat; diffuseUrl: string | null } | null {
  const url = pickPolyHavenModelFormatUrl(links, "fbx", resolution);
  if (!url || !polyHavenMeshUrlEndsWithFbx(url)) return null;
  const diffuseUrl = pickPolyHavenDiffuseUrl(links, resolution);
  return { url, format: "fbx", diffuseUrl };
}

/** Single fetch: mesh + optional Poly Haven diffuse for UE import. */
export async function getPolyHavenModelImportUrls(
  assetId: string,
  resolution = "1k"
): Promise<{ meshUrl: string; diffuseUrl: string | null } | null> {
  const links = (await getDownloadLinks(assetId)) as unknown as Record<string, unknown>;
  if (!links || typeof links !== "object") return null;
  const resolved = resolvePolyHavenModelDownloadUrl(links, resolution);
  if (!resolved) return null;
  return { meshUrl: resolved.url, diffuseUrl: resolved.diffuseUrl };
}

export async function getModelDownloadUrl(assetId: string, resolution = "1k"): Promise<string | null> {
  const links = await getDownloadLinks(assetId) as Record<string, unknown>;
  if (!links || typeof links !== "object") {
    console.log("[Poly Haven] getModelDownloadUrl:", assetId, "-> links empty");
    return null;
  }
  const keys = Object.keys(links);
  console.log("[Poly Haven] getModelDownloadUrl:", assetId, "-> links keys:", keys);

  const resolved = resolvePolyHavenModelDownloadUrl(links, resolution);
  if (resolved) {
    console.log(
      "[Poly Haven] getModelDownloadUrl:",
      assetId,
      "-> URL found (" + resolved.format + ")",
      resolved.diffuseUrl ? "+diffuse" : ""
    );
    return resolved.url;
  }
  console.log("[Poly Haven] getModelDownloadUrl:", assetId, "-> NO download URL");
  return null;
}

export async function getTextureDownloadUrls(
  assetId: string,
  resolution = "1k"
): Promise<{ diffuse?: string; normal?: string; roughness?: string; displacement?: string }> {
  const links = await getDownloadLinks(assetId);
  const res = resolution in (links ?? {}) ? resolution : "1k";
  const resData = links?.[res] as Record<string, { url?: string }> | undefined;
  if (!resData) return {};

  return {
    diffuse: resData?.["Diffuse"]?.url ?? resData?.["diffuse"]?.url ?? resData?.["Color"]?.url,
    normal: resData?.["nor_gl"]?.url ?? resData?.["Normal"]?.url ?? resData?.["normal"]?.url,
    roughness: resData?.["Rough"]?.url ?? resData?.["roughness"]?.url,
    displacement: resData?.["Displacement"]?.url ?? resData?.["displacement"]?.url,
  };
}

export async function getHDRIDownloadUrl(assetId: string, resolution = "2k"): Promise<string | null> {
  const links = await getDownloadLinks(assetId);
  const hdr = links?.hdri?.[resolution]?.url ?? links?.hdri?.["2k"]?.url ?? links?.hdri?.["1k"]?.url;
  return hdr ?? null;
}

/** Homepage / browse card model (normalized across sources). */
export interface Model {
  id: string;
  name: string;
  thumbnail: string;
  source: string;
  downloads: number;
  isFree: boolean;
  categories: string[];
  tags: string[];
  kind?: "model" | "texture" | "hdri";
}

export interface FetchOptions {
  type?: PolyHavenAssetType;
  categories?: string[];
  search?: string;
  limit?: number;
}

function toModel(asset: PolyHavenAsset, thumbWidth = 400): Model {
  const kind =
    asset.type === "textures"
      ? "texture"
      : asset.type === "hdris"
        ? "hdri"
        : "model";
  return {
    id: asset.id,
    name: asset.name,
    thumbnail: getThumbnailUrl(asset.id, thumbWidth),
    source: "Poly Haven",
    downloads: asset.downloadCount,
    isFree: true,
    categories: asset.categories,
    tags: asset.tags,
    kind,
  };
}

/**
 * Fetch Poly Haven assets for marketplace UI (featured grid, browse).
 * Filters by category when provided; uses ranked search when `search` is set.
 */
export async function getPolyHavenAssets(options: FetchOptions = {}): Promise<Model[]> {
  const { type = "models", categories = [], search, limit = 40 } = options;
  const capped = Math.max(1, Math.min(50, limit));

  try {
    if (search?.trim()) {
      const results = await searchAssets(search.trim(), type, capped * 2);
      const filtered =
        categories.length > 0
          ? results.filter((a) =>
              categories.some((c) =>
                a.categories.some((ac) => ac.toLowerCase().includes(c.toLowerCase()))
              )
            )
          : results;
      return filtered.slice(0, capped).map((a) => toModel(a));
    }

    const all = await getAssets(type);
    let list = all;
    if (categories.length > 0) {
      list = all.filter((a) =>
        categories.some((c) =>
          a.categories.some((ac) => ac.toLowerCase().includes(c.toLowerCase()))
        )
      );
    }
    list = [...list].sort((a, b) => b.downloadCount - a.downloadCount);
    return list.slice(0, capped).map((a) => toModel(a));
  } catch (error) {
    console.error("[Poly Haven] getPolyHavenAssets error:", error);
    return [];
  }
}

export async function getPolyHavenAsset(id: string): Promise<Model | null> {
  try {
    const info = (await getAssetInfo(id)) as {
      name?: string;
      categories?: string[];
      tags?: string[];
      download_count?: number;
    };
    if (!info) return null;
    return {
      id,
      name: info.name ?? id.replace(/_/g, " "),
      thumbnail: getThumbnailUrl(id, 1200),
      source: "Poly Haven",
      downloads: info.download_count ?? 0,
      isFree: true,
      categories: info.categories ?? [],
      tags: info.tags ?? [],
    };
  } catch (error) {
    console.error("[Poly Haven] getPolyHavenAsset error:", error);
    return null;
  }
}

export interface PolyHavenCategory {
  slug: string;
  name: string;
  count: number;
}

/** Category list with counts from Poly Haven `/categories/{type}`. */
export async function getPolyHavenCategories(
  type: PolyHavenAssetType = "models"
): Promise<PolyHavenCategory[]> {
  try {
    const data = (await phFetch(`/categories/${type}`)) as Record<string, number>;
    return Object.entries(data)
      .filter(([slug]) => slug !== "all")
      .map(([slug, count]) => ({
        slug,
        name: slug
          .replace(/^collection:\s*/i, "")
          .split(/[\s_]+/)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" "),
        count,
      }))
      .sort((a, b) => b.count - a.count);
  } catch (error) {
    console.error("[Poly Haven] getPolyHavenCategories error:", error);
    return [];
  }
}

export type BrowseSort = "newest" | "popular" | "downloads" | "name";

export interface FetchOptionsExtended extends FetchOptions {
  sort?: BrowseSort;
  offset?: number;
  sources?: string[];
  licenses?: string[];
}

/**
 * Browse-oriented fetch with sort + offset pagination.
 * Keeps `getPolyHavenAssets` unchanged for homepage / featured sections.
 */
export async function getPolyHavenAssetsExtended(
  options: FetchOptionsExtended = {}
): Promise<{ models: Model[]; total: number }> {
  const {
    type = "models",
    categories = [],
    search,
    limit = 24,
    offset = 0,
    sort = "popular",
    sources = [],
    licenses = [],
  } = options;

  const pageSize = Math.max(1, Math.min(48, limit));
  const start = Math.max(0, offset);

  try {
    // Source / license soft-filters: only Poly Haven + CC0 are live today.
    if (sources.length > 0 && !sources.includes("polyhaven")) {
      return { models: [], total: 0 };
    }
    if (licenses.length > 0 && !licenses.includes("cc0")) {
      return { models: [], total: 0 };
    }

    let list: PolyHavenAsset[];

    if (search?.trim()) {
      const ranked = await searchAssets(search.trim(), type, 500);
      list = ranked;
    } else {
      list = await getAssets(type);
    }

    if (categories.length > 0) {
      list = list.filter((asset) =>
        categories.some((c) =>
          asset.categories.some((ac) => ac.toLowerCase() === c.toLowerCase())
        )
      );
    }

    const sorted = [...list];
    switch (sort) {
      case "newest":
        sorted.sort((a, b) => b.datePublished - a.datePublished);
        break;
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "popular":
      case "downloads":
        sorted.sort((a, b) => b.downloadCount - a.downloadCount);
        break;
      default: {
        const _exhaustive: never = sort;
        void _exhaustive;
        sorted.sort((a, b) => b.downloadCount - a.downloadCount);
        break;
      }
    }

    const total = sorted.length;
    const models = sorted.slice(start, start + pageSize).map((a) => toModel(a));
    return { models, total };
  } catch (error) {
    console.error("[Poly Haven] getPolyHavenAssetsExtended error:", error);
    return { models: [], total: 0 };
  }
}

/** Detailed asset metadata from `/info/{id}` (verified against live Poly Haven API). */
export interface PolyHavenAssetInfo {
  name: string;
  type: number;
  categories: string[];
  tags: string[];
  authors: Record<string, string>;
  thumbnail_url?: string;
  download_count: number;
  date_published: number;
  /** Millimeters (x, y, z) — convert to meters for display. */
  dimensions?: [number, number, number];
  /** Poly Haven field name is `polycount`. */
  polycount?: number;
  description?: string;
  donated?: boolean;
  max_resolution?: [number, number];
  texel_density?: number;
}

export interface PolyHavenFileEntry {
  url: string;
  md5?: string;
  size: number;
  include?: Record<string, PolyHavenFileEntry>;
}

/** Top-level mesh formats from `/files/{id}` (models also include texture maps). */
export interface PolyHavenFiles {
  blend?: Record<string, Record<string, PolyHavenFileEntry>>;
  fbx?: Record<string, Record<string, PolyHavenFileEntry>>;
  gltf?: Record<string, Record<string, PolyHavenFileEntry>>;
  usd?: Record<string, Record<string, PolyHavenFileEntry>>;
  [key: string]: unknown;
}

export type PolyHavenMeshFormat = "gltf" | "fbx" | "usd" | "blend";

const RESOLUTION_PREFERENCE = ["1k", "2k", "4k", "8k"] as const;

export async function getPolyHavenAssetInfo(
  id: string
): Promise<PolyHavenAssetInfo | null> {
  try {
    const data = (await getAssetInfo(id)) as PolyHavenAssetInfo;
    if (!data?.name) return null;
    return {
      ...data,
      categories: data.categories ?? [],
      tags: data.tags ?? [],
      authors: data.authors ?? {},
      download_count: data.download_count ?? 0,
      date_published: data.date_published ?? 0,
    };
  } catch (error) {
    console.error("[Poly Haven] getPolyHavenAssetInfo error:", error);
    return null;
  }
}

export async function getPolyHavenAssetFiles(
  id: string
): Promise<PolyHavenFiles | null> {
  try {
    const data = (await getDownloadLinks(id)) as unknown as PolyHavenFiles;
    if (!data || typeof data !== "object") return null;
    return data;
  } catch (error) {
    console.error("[Poly Haven] getPolyHavenAssetFiles error:", error);
    return null;
  }
}

/** Pick the mesh file entry for a format (prefers lower-res for preview/download UX). */
export function pickPolyHavenFormatEntry(
  files: PolyHavenFiles | null | undefined,
  formatKey: PolyHavenMeshFormat,
  preferredResolution = "1k"
): { resolution: string; entry: PolyHavenFileEntry } | null {
  if (!files) return null;
  const formatBlock = files[formatKey];
  if (!formatBlock || typeof formatBlock !== "object") return null;

  const order = [
    preferredResolution,
    ...RESOLUTION_PREFERENCE.filter((r) => r !== preferredResolution),
  ];

  for (const res of order) {
    const resBlock = formatBlock[res];
    if (!resBlock || typeof resBlock !== "object") continue;
    const nested = resBlock[formatKey] ?? Object.values(resBlock)[0];
    if (
      nested &&
      typeof nested === "object" &&
      typeof nested.url === "string" &&
      nested.url.length > 0
    ) {
      return { resolution: res, entry: nested };
    }
  }
  return null;
}

/** Total download size including nested texture includes when present. */
export function getPolyHavenFormatSize(entry: PolyHavenFileEntry): number {
  let total = entry.size || 0;
  if (entry.include) {
    for (const part of Object.values(entry.include)) {
      total += part.size || 0;
    }
  }
  return total;
}

export async function getSimilarModels(
  id: string,
  categories: string[],
  limit = 4
): Promise<Model[]> {
  try {
    const cats = categories.filter(Boolean).slice(0, 2);
    const { models } = await getPolyHavenAssetsExtended({
      type: "models",
      categories: cats.length > 0 ? cats : undefined,
      limit: limit + 8,
      sort: "popular",
    });
    return models.filter((m) => m.id !== id).slice(0, limit);
  } catch (error) {
    console.error("[Poly Haven] getSimilarModels error:", error);
    return [];
  }
}

export interface CatalogFileOption {
  key: string;
  label: string;
  description: string;
  url: string;
  size: number;
}

function collectFileEntries(
  node: unknown,
  path: string[],
  out: CatalogFileOption[]
): void {
  if (!node || typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  if (typeof record.url === "string" && record.url.length > 0) {
    const key = path.join("-") || "file";
    out.push({
      key,
      label: path[path.length - 1]?.toUpperCase() || "File",
      description: path.slice(0, -1).join(" · ") || "Download",
      url: record.url,
      size: typeof record.size === "number" ? record.size : 0,
    });
    return;
  }
  for (const [name, child] of Object.entries(record)) {
    if (name === "include" || name === "md5") continue;
    collectFileEntries(child, [...path, name], out);
  }
}

export function listPolyHavenPackageDownloads(
  files: PolyHavenFiles | null | undefined
): CatalogFileOption[] {
  if (!files) return [];
  const zipBlock = files.zip;
  if (zipBlock) {
    const zips: CatalogFileOption[] = [];
    collectFileEntries(zipBlock, ["zip"], zips);
    if (zips.length > 0) return zips.slice(0, 8);
  }
  const hdriBlock = files.hdri;
  if (hdriBlock) {
    const hdris: CatalogFileOption[] = [];
    collectFileEntries(hdriBlock, ["hdri"], hdris);
    if (hdris.length > 0) return hdris.slice(0, 8);
  }
  return [];
}
