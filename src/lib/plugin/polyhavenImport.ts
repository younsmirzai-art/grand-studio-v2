const USER_AGENT = "GrandStudio/1.0 (contact@grandstudio.dev)";

/**
 * Same intent as sceneBuildEngine SEARCH_MAP: map user terms to Poly Haven search keywords
 * and filter API results so generic searches (e.g. "tree") don't return unrelated models.
 */
export const PLUGIN_POLYHAVEN_SEARCH_MAP: Record<string, string[]> = {
  house: ["house", "cottage", "cabin", "residential building"],
  building: ["building", "office building", "commercial building"],
  skyscraper: ["skyscraper", "tall building", "tower"],
  shop: ["shop", "store", "retail"],
  hospital: ["hospital", "medical building", "clinic"],
  church: ["church", "chapel"],
  castle: ["castle", "fortress", "medieval building"],
  tavern: ["tavern", "inn", "pub"],
  tree: ["tree", "oak", "pine", "birch", "palm", "oak tree", "deciduous tree", "conifer", "spruce"],
  pine: ["pine tree", "conifer", "spruce"],
  palm: ["palm tree", "tropical tree", "coconut palm"],
  cactus: ["cactus", "desert plant"],
  bush: ["bush", "shrub", "hedge"],
  car: ["car", "sedan", "automobile"],
  truck: ["truck", "pickup truck", "van"],
  boat: ["boat", "sailboat", "fishing boat"],
  street_light: ["street light", "lamp post", "lantern"],
  traffic_light: ["traffic light", "traffic signal", "stop light"],
  bench: ["bench", "park bench", "garden bench"],
  rock: ["rock", "boulder", "stone"],
  barrel: ["barrel", "wooden barrel"],
  crate: ["crate", "wooden crate", "box"],
  fence: ["fence", "wooden fence", "garden fence"],
  wall: ["wall", "stone wall", "brick wall"],
  mailbox: ["mailbox", "post box"],
  fire_hydrant: ["fire hydrant"],
  road: ["road", "street", "pathway"],
};

export type PolyHavenImportHit = { id: string; name: string; fbxUrl: string };

export type PluginImportStep = {
  action: "import";
  name: string;
  url: string;
  destination: string;
};

function keywordsForPolyHavenUserTerm(term: string): string[] {
  const t = term.toLowerCase().trim();
  return PLUGIN_POLYHAVEN_SEARCH_MAP[t] ?? [t, `${t} nature`, `3d ${t}`];
}

function polyAssetMatchesKeywords(assetId: string, displayName: string, keywords: string[]): boolean {
  const hay = `${assetId} ${displayName}`.toLowerCase().replace(/_/g, " ");
  return keywords.some((kw) => {
    const parts = kw
      .toLowerCase()
      .split(/\s+/)
      .filter((p) => p.length > 2);
    return parts.some((p) => hay.includes(p));
  });
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

async function fetchPolyHavenModelKeysForQuery(searchQuery: string): Promise<Record<string, { name?: string }>> {
  const q = encodeURIComponent(searchQuery.trim());
  const url = `https://api.polyhaven.com/assets?t=models&s=${q}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Poly Haven search failed: ${res.status}`);
  return (await res.json()) as Record<string, { name?: string }>;
}

/**
 * Search Poly Haven models and resolve FBX download URLs for the first `limit` hits that have FBX.
 * Uses SEARCH_MAP keywords + result filtering to avoid irrelevant hits (e.g. furniture for "tree").
 */
export async function polyHavenTopModelsWithFbx(searchTerm: string, limit = 3): Promise<PolyHavenImportHit[]> {
  const keywords = keywordsForPolyHavenUserTerm(searchTerm);
  const orderedIds: string[] = [];
  const seen = new Set<string>();
  const idToDisplayName = new Map<string, string>();

  for (const kw of keywords.slice(0, 8)) {
    let raw: Record<string, { name?: string }>;
    try {
      raw = await fetchPolyHavenModelKeysForQuery(kw);
    } catch {
      continue;
    }
    for (const id of Object.keys(raw)) {
      if (seen.has(id)) continue;
      const disp = raw[id]?.name ?? id.replace(/_/g, " ");
      if (!polyAssetMatchesKeywords(id, disp, keywords)) continue;
      orderedIds.push(id);
      seen.add(id);
      idToDisplayName.set(id, disp);
    }
    if (orderedIds.length >= limit * 4) break;
  }

  /** If filters were too tight, fall back to unfiltered results from the best keyword search. */
  if (orderedIds.length === 0) {
    const primary = keywords[0] ?? searchTerm;
    const raw = await fetchPolyHavenModelKeysForQuery(primary);
    for (const id of Object.keys(raw)) {
      if (seen.has(id)) continue;
      orderedIds.push(id);
      seen.add(id);
      idToDisplayName.set(id, raw[id]?.name ?? id.replace(/_/g, " "));
    }
  }

  const out: PolyHavenImportHit[] = [];
  for (const id of orderedIds) {
    if (out.length >= limit) break;
    const filesRes = await fetch(`https://api.polyhaven.com/files/${id}`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!filesRes.ok) continue;
    const files = (await filesRes.json()) as Record<string, unknown>;
    const fbxUrl = pickFbxUrl(files);
    if (!fbxUrl) continue;
    out.push({
      id,
      name: idToDisplayName.get(id) ?? id.replace(/_/g, " "),
      fbxUrl,
    });
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
