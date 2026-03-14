/**
 * Resolve direct Poly Haven model download URL (no Supabase upload).
 * UE5 Python code downloads directly from this URL via urllib.request.urlretrieve.
 */

import { createClient } from "@supabase/supabase-js";

const USER_AGENT = "GrandStudio/1.0";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase credentials");
  return createClient(url, key);
}

/**
 * 1) Check downloaded_assets cache for existing direct URL
 * 2) GET api.polyhaven.com/files/ASSET_ID
 * 3) Prefer GLB, then FBX, then GLTF — get direct download URL
 * 4) Cache the direct URL in downloaded_assets (no file upload)
 * 5) Return direct Poly Haven URL for UE5 to download
 */
export async function downloadPolyHavenModelToStorage(assetId: string): Promise<string | null> {
  const supabase = getSupabase();

  const { data: existing } = await supabase
    .from("downloaded_assets")
    .select("storage_url")
    .eq("source", "polyhaven")
    .eq("source_id", assetId)
    .maybeSingle();

  if (existing?.storage_url) {
    return existing.storage_url;
  }

  const filesRes = await fetch(`https://api.polyhaven.com/files/${assetId}`, {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
  });
  if (!filesRes.ok) return null;

  const filesData = await filesRes.json();

  type Format = "glb" | "fbx" | "gltf";
  let downloadUrl: string | null = null;
  let ext: Format = "gltf";

  function pickUrl(formatKey: "glb" | "fbx" | "gltf"): string | null {
    const block = filesData[formatKey];
    if (!block || typeof block !== "object") return null;
    const oneK = block["1k"] ?? block["2k"];
    if (!oneK) return null;
    const u = oneK.url ?? oneK[formatKey]?.url ?? oneK.gltf?.url ?? null;
    return u || null;
  }

  if (filesData.glb) {
    downloadUrl = pickUrl("glb");
    if (downloadUrl) ext = "glb";
  }
  if (!downloadUrl && filesData.fbx) {
    downloadUrl = pickUrl("fbx");
    if (downloadUrl) ext = "fbx";
  }
  if (!downloadUrl && filesData.gltf) {
    const gltf = filesData.gltf;
    const oneK = gltf["1k"] ?? gltf["2k"];
    if (oneK) downloadUrl = oneK.url ?? oneK.gltf?.url ?? null;
    if (downloadUrl) ext = "gltf";
  }
  if (!downloadUrl && filesData["1k"]?.gltf?.url) {
    downloadUrl = filesData["1k"].gltf.url;
    ext = "gltf";
  }
  if (!downloadUrl) return null;

  await supabase.from("downloaded_assets").upsert(
    {
      source: "polyhaven",
      source_id: assetId,
      name: assetId.replace(/_/g, " "),
      storage_url: downloadUrl,
      format: ext,
      file_size_bytes: 0,
      license: "CC0",
    },
    { onConflict: "source,source_id" }
  );
  return downloadUrl;
}
