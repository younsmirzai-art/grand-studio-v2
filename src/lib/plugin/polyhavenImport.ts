const USER_AGENT = "GrandStudio/1.0 (contact@grandstudio.dev)";

export type PolyHavenImportHit = { id: string; name: string; fbxUrl: string };

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

function pyStr(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Python script: download FBX files and import into /Game/GrandStudio/Imported/ (UE 5.7-safe AssetImportTask fields only). */
export function buildPolyHavenImportPython(hits: PolyHavenImportHit[]): string {
  let script = `import unreal
import urllib.request
import os
import time

os.makedirs('C:/GrandStudio/Downloads', exist_ok=True)
try:
    unreal.EditorAssetLibrary.make_directory('/Game/GrandStudio/Imported')
except:
    pass

tasks = [
`;
  for (const h of hits) {
    const safeId = h.id.replace(/ /g, "_");
    script += `    ("${pyStr(h.fbxUrl)}", "${pyStr(`C:/GrandStudio/Downloads/${safeId}.fbx`)}", "${pyStr(safeId)}"),\n`;
  }
  script += `]

for i, (url, filepath, dest_name) in enumerate(tasks):
    if i > 0:
        time.sleep(10)
    urllib.request.urlretrieve(url, filepath)
    task = unreal.AssetImportTask()
    task.filename = filepath
    task.destination_path = '/Game/GrandStudio/Imported'
    task.destination_name = dest_name
    task.replace_existing = True
    task.automated = True
    task.save = True
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    unreal.log('Imported ' + dest_name)
`;
  return script;
}
