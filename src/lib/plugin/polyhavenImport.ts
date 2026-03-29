const USER_AGENT = "GrandStudio/1.0 (contact@grandstudio.dev)";

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

export type PolyHavenImportHit = { id: string; name: string; fbxUrl: string };

export type PluginImportStep = {
  action: "import";
  name: string;
  url: string;
  destination: string;
};

type PolyHavenSearchRow = { name?: string; download_count?: number };

function filterKeywordsForUserTerm(term: string): string[] {
  const t = term.toLowerCase().trim();
  return SEARCH_MAP[t] ?? [t];
}

/** Whole-word / token match so "fir" does not match "fire" and "chair" does not match "armchair". */
function keywordMatchesAssetText(haystack: string, kw: string): boolean {
  const k = kw.toLowerCase().trim().replace(/_/g, " ");
  if (!k.length) return false;
  const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, "i");
  return re.test(haystack);
}

/** True if asset id or display name matches at least one filter keyword. */
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
  if (!res.ok) throw new Error(`Poly Haven search failed: ${res.status}`);
  return (await res.json()) as Record<string, PolyHavenSearchRow>;
}

/**
 * Search Poly Haven models and resolve FBX URLs for the first `limit` hits that have FBX.
 * Results from the API are filtered so id/name must match SEARCH_MAP keywords for the user term
 * (or the literal term when unmapped), then sorted by download_count descending.
 */
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

/** Build step objects for the plugin to execute locally (no server download/import). */
export function polyHavenHitsToImportSteps(hits: PolyHavenImportHit[]): PluginImportStep[] {
  return hits.map((h) => {
    const name = h.id.replace(/ /g, "_");
    return {
      action: "import",
      name,
      url: h.fbxUrl,
      destination: `/Game/GrandStudio/Imported/${name}`,
    };
  });
}
