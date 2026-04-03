import { searchModels, getDownloadUrl } from "@/lib/sketchfab/client";

const USER_AGENT = "GrandStudio/1.0 (contact@grandstudio.dev)";

export const GRAND_STUDIO_ASSET_PRO = "Grand Studio Asset Pro";
export const GRAND_STUDIO_ASSETS = "Grand Studio Assets";

/** Maps user import terms to keywords that must appear in Poly Haven asset id or name. */
const SEARCH_MAP: Record<string, string[]> = {
  tree: ["tree", "oak", "pine", "birch", "palm", "willow", "maple", "spruce", "fir", "plant"],
  house: ["house", "building", "cabin", "cottage", "barn", "shed"],
  rock: ["rock", "stone", "boulder", "cliff", "pebble"],
  car: ["car", "vehicle", "truck", "van"],
  chair: ["chair", "seat", "stool", "bench", "armchair"],
  table: ["table", "desk", "counter"],
  plant: ["plant", "flower", "bush", "shrub", "grass", "fern", "cactus", "potted"],
  lamp: ["lamp", "light", "lantern", "chandelier"],
  barrel: ["barrel", "drum", "container", "crate"],
  fence: ["fence", "wall", "gate", "railing"],
  food: ["food", "fruit", "bread"],
};

const TERM_TO_MATERIAL_CATEGORY: Record<string, string> = {
  tree: "plant",
  plant: "plant",
  vegetation: "plant",
  chair: "furniture",
  table: "furniture",
  barrel: "barrel",
  lamp: "metal",
  car: "metal",
  house: "building",
  rock: "rock",
  fence: "building",
  food: "furniture",
};

export type PolyHavenImportHit = { id: string; name: string; fbxUrl: string };

export type PluginImportStep = {
  action: "import";
  name: string;
  url: string;
  destination: string;
  source?: string;
  importType?: "fbx" | "zip";
  materialCategory?: string;
};

export type SketchfabPluginHit = { uid: string; name: string; zipOrArchiveUrl: string };

type PerSourceCount = { pro: number; assets: number };

type PolyHavenSearchRow = { name?: string; download_count?: number };

function filterKeywordsForUserTerm(term: string): string[] {
  const t = term.toLowerCase().trim();
  return SEARCH_MAP[t] ?? [t];
}

function keywordMatchesAssetText(haystack: string, kw: string): boolean {
  const k = kw.toLowerCase().trim().replace(/_/g, " ");
  if (!k.length) return false;
  const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, "i");
  return re.test(haystack);
}

function assetMatchesFilterKeywords(assetId: string, displayName: string, keywords: string[]): boolean {
  const haystack = `${assetId} ${displayName}`.toLowerCase().replace(/_/g, " ");
  return keywords.some((kw) => keywordMatchesAssetText(haystack, kw));
}

function pickFbxUrl(filesRoot: Record<string, unknown>): string | null {
  const fbxCat = filesRoot.fbx as Record<string, unknown> | undefined;
  if (!fbxCat) return null;
  for (const res of ["2k", "4k", "1k"] as const) {
    const resObj = fbxCat[res] as Record<string, unknown> | undefined;
    if (!resObj) continue;
    const inner = resObj.fbx as { url?: string } | undefined;
    if (inner?.url) return inner.url;
  }
  return null;
}

async function fetchPolyHavenModelKeysForQuery(searchQuery: string): Promise<Record<string, PolyHavenSearchRow>> {
  const q = encodeURIComponent(searchQuery.trim());
  const url = `https://api.polyhaven.com/assets?t=models&s=${q}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Grand Studio Asset Pro search failed: ${res.status}`);
  return (await res.json()) as Record<string, PolyHavenSearchRow>;
}

export function materialCategoryForSearchTerm(term: string): string {
  const t = term.toLowerCase().trim();
  return TERM_TO_MATERIAL_CATEGORY[t] ?? "furniture";
}

function slugName(name: string, suffix: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const short = suffix.replace(/-/g, "").slice(0, 8);
  const joined = `${base}_${short}`.replace(/^_+|_+$/g, "");
  return joined.length >= 4 ? joined : `model_${short || "sf"}`;
}

export async function polyHavenTopModelsWithFbx(searchTerm: string, limit = 3): Promise<PolyHavenImportHit[]> {
  const filterKeywords = filterKeywordsForUserTerm(searchTerm);
  const raw = await fetchPolyHavenModelKeysForQuery(searchTerm);

  const rows: Array<{ id: string; name: string; downloadCount: number }> = [];
  for (const id of Object.keys(raw)) {
    const disp = raw[id]?.name ?? id.replace(/_/g, " ");
    const downloadCount = raw[id]?.download_count ?? 0;
    rows.push({ id, name: disp, downloadCount });
  }

  const ordered = rows
    .filter((r) => assetMatchesFilterKeywords(r.id, r.name, filterKeywords))
    .sort((a, b) => b.downloadCount - a.downloadCount);

  const out: PolyHavenImportHit[] = [];
  for (const { id, name } of ordered) {
    if (out.length >= limit) break;
    const filesRes = await fetch(`https://api.polyhaven.com/files/${id}`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!filesRes.ok) continue;
    const files = (await filesRes.json()) as Record<string, unknown>;
    const fbxUrl = pickFbxUrl(files);
    if (!fbxUrl) continue;
    out.push({ id, name, fbxUrl });
  }

  return out;
}

export function polyHavenHitsToImportSteps(hits: PolyHavenImportHit[], searchTerm: string): PluginImportStep[] {
  const matCat = materialCategoryForSearchTerm(searchTerm);
  return hits.map((h) => {
    const name = h.id.replace(/ /g, "_");
    return {
      action: "import",
      name,
      url: h.fbxUrl,
      destination: `/Game/GrandStudio/Imported/Meshes/${name}`,
      source: GRAND_STUDIO_ASSET_PRO,
      importType: "fbx",
      materialCategory: matCat,
    };
  });
}

/**
 * Extra hits from Grand Studio Assets (Sketchfab API) when Asset Pro returns fewer than `targetTotal`.
 */
export async function sketchfabPluginHits(searchTerm: string, want: number): Promise<SketchfabPluginHit[]> {
  if (want <= 0) return [];
  const token = typeof process.env.SKETCHFAB_API_TOKEN === "string" ? process.env.SKETCHFAB_API_TOKEN.trim() : "";
  if (!token) return [];

  const models = await searchModels(searchTerm, {
    count: Math.min(20, want + 5),
    token,
    sortBy: "-likeCount",
  });

  const out: SketchfabPluginHit[] = [];
  for (const m of models) {
    if (out.length >= want) break;
    const url = await getDownloadUrl(m.uid, token);
    if (!url) continue;
    out.push({ uid: m.uid, name: m.name, zipOrArchiveUrl: url });
  }
  return out;
}

export function sketchfabHitsToImportSteps(hits: SketchfabPluginHit[], searchTerm: string): PluginImportStep[] {
  const matCat = materialCategoryForSearchTerm(searchTerm);
  return hits.map((h) => {
    const name = slugName(h.name, h.uid);
    return {
      action: "import",
      name,
      url: h.zipOrArchiveUrl,
      destination: `/Game/GrandStudio/Imported/Meshes/${name}`,
      source: GRAND_STUDIO_ASSETS,
      importType: "zip",
      materialCategory: matCat,
    };
  });
}

export async function combinedLibraryImportSteps(
  searchTerm: string,
  targetTotal = 3,
): Promise<{ steps: PluginImportStep[]; counts: PerSourceCount; descriptionParts: string[] }> {
  const proHits = await polyHavenTopModelsWithFbx(searchTerm, targetTotal);
  let steps = polyHavenHitsToImportSteps(proHits, searchTerm);
  const counts: PerSourceCount = { pro: proHits.length, assets: 0 };
  const descriptionParts: string[] = [];

  if (proHits.length > 0) {
    descriptionParts.push(
      `Found ${proHits.length} model(s) from ${GRAND_STUDIO_ASSET_PRO}: ${proHits.map((h) => h.id).join(", ")}`,
    );
  }

  if (proHits.length < targetTotal) {
    const need = targetTotal - proHits.length;
    const sfHits = await sketchfabPluginHits(searchTerm, need);
    counts.assets = sfHits.length;
    if (sfHits.length > 0) {
      descriptionParts.push(
        `Found ${sfHits.length} model(s) from ${GRAND_STUDIO_ASSETS}: ${sfHits.map((h) => slugName(h.name, h.uid)).join(", ")}`,
      );
      steps = [...steps, ...sketchfabHitsToImportSteps(sfHits, searchTerm)];
    }
  }

  return { steps, counts, descriptionParts };
}
