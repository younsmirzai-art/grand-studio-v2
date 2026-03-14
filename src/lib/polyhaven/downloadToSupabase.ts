/**
 * Poly Haven model download + Supabase upload.
 * Logic is identical to /api/test/download so it stays proven to work.
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
 * 1) GET api.polyhaven.com/files/ASSET_ID
 * 2) Parse gltf.1k.url or gltf.2k.url (same as test/download)
 * 3) Download file
 * 4) Upload to polyhaven-assets bucket
 * 5) Return public URL (and cache in downloaded_assets)
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

  // Prefer GLB (single file), then FBX (single file), then GLTF (multi-file; last resort)
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

  const fileRes = await fetch(downloadUrl, { cache: "no-store" });
  if (!fileRes.ok) return null;
  const blob = await fileRes.blob();

  const storagePath = `polyhaven/${assetId}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from("polyhaven-assets")
    .upload(storagePath, blob, {
      contentType: blob.type || "application/octet-stream",
      upsert: true,
    });

  if (uploadErr) {
    await supabase.from("downloaded_assets").upsert(
      {
        source: "polyhaven",
        source_id: assetId,
        name: assetId.replace(/_/g, " "),
        storage_url: downloadUrl,
        format: ext,
        file_size_bytes: blob.size,
        license: "CC0",
      },
      { onConflict: "source,source_id" }
    );
    return downloadUrl;
  }

  const { data: publicUrl } = supabase.storage.from("polyhaven-assets").getPublicUrl(storagePath);
  await supabase.from("downloaded_assets").upsert(
    {
      source: "polyhaven",
      source_id: assetId,
      name: assetId.replace(/_/g, " "),
      storage_url: publicUrl.publicUrl,
      format: ext,
      file_size_bytes: blob.size,
      license: "CC0",
    },
    { onConflict: "source,source_id" }
  );
  return publicUrl.publicUrl;
}
