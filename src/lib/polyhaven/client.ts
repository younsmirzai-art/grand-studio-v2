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

function parseAssetList(raw: Record<string, { name?: string; categories?: string[]; tags?: string[]; download_count?: number }>, type: PolyHavenAssetType): PolyHavenAsset[] {
  return Object.entries(raw).map(([id, data]) => ({
    id,
    name: data.name ?? id.replace(/_/g, " "),
    type,
    categories: data.categories ?? [],
    tags: data.tags ?? [],
    downloadCount: data.download_count ?? 0,
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
}

export interface FetchOptions {
  type?: PolyHavenAssetType;
  categories?: string[];
  search?: string;
  limit?: number;
}

function toModel(asset: PolyHavenAsset, thumbWidth = 400): Model {
  return {
    id: asset.id,
    name: asset.name,
    thumbnail: getThumbnailUrl(asset.id, thumbWidth),
    source: "Poly Haven",
    downloads: asset.downloadCount,
    isFree: true,
    categories: asset.categories,
    tags: asset.tags,
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
