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

export async function searchAssets(
  query: string,
  type: PolyHavenAssetType,
  count = 20
): Promise<PolyHavenAsset[]> {
  const all = await getAssets(type);
  const q = query.toLowerCase();
  const matches = all.filter(
    (a) =>
      a.name.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q) ||
      a.categories.some((c) => c.toLowerCase().includes(q)) ||
      a.tags.some((t) => t.toLowerCase().includes(q))
  );
  matches.sort((a, b) => b.downloadCount - a.downloadCount);
  return matches.slice(0, count);
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

export type PolyHavenModelFormat = "glb" | "fbx" | "gltf";

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
 * Only reads top-level glb / fbx / gltf blocks (not material map trees).
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
    const top = rb.url;
    if (typeof top === "string" && top.length > 0) return top;
    const nested = rb[formatKey];
    if (nested && typeof nested === "object" && nested !== null && "url" in nested) {
      const u = (nested as { url?: unknown }).url;
      if (typeof u === "string" && u.length > 0) return u;
    }
    if (formatKey === "gltf" && rb.gltf && typeof rb.gltf === "object") {
      const u = (rb.gltf as { url?: unknown }).url;
      if (typeof u === "string" && u.length > 0) return u;
    }
  }
  return null;
}

/** Prefer GLB (embedded textures), then glTF, then FBX (often geometry-only). */
export function resolvePolyHavenModelDownloadUrl(
  links: Record<string, unknown>,
  resolution = "1k"
): { url: string; format: PolyHavenModelFormat } | null {
  const order: PolyHavenModelFormat[] = ["glb", "gltf", "fbx"];
  for (const fmt of order) {
    const url = pickPolyHavenModelFormatUrl(links, fmt, resolution);
    if (url) return { url, format: fmt };
  }
  return null;
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
    console.log("[Poly Haven] getModelDownloadUrl:", assetId, "-> URL found (" + resolved.format + ")");
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
