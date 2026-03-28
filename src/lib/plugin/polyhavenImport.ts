const USER_AGENT = "GrandStudio/1.0 (contact@grandstudio.dev)";

export type PolyHavenImportHit = { id: string; name: string; fbxUrl: string };

export type PluginImportStep = {
  action: "import";
  name: string;
  url: string;
  destination: string;
};

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

/**
 * Search Poly Haven models and resolve FBX download URLs for the first `limit` hits that have FBX.
 */
export async function polyHavenTopModelsWithFbx(searchTerm: string, limit = 3): Promise<PolyHavenImportHit[]> {
  const q = encodeURIComponent(searchTerm.trim());
  const url = `https://api.polyhaven.com/assets?t=models&s=${q}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Poly Haven search failed: ${res.status}`);
  const raw = (await res.json()) as Record<string, { name?: string }>;
  const keys = Object.keys(raw);
  const out: PolyHavenImportHit[] = [];

  for (const id of keys) {
    if (out.length >= limit) break;
    const filesRes = await fetch(`https://api.polyhaven.com/files/${id}`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!filesRes.ok) continue;
    const files = (await filesRes.json()) as Record<string, unknown>;
    const fbxUrl = pickFbxUrl(files);
    if (!fbxUrl) continue;
    const name = raw[id]?.name ?? id.replace(/_/g, " ");
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
