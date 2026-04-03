/**
 * Resolve direct Poly Haven model download URL (no Supabase upload).
 * UE5 Python code downloads directly from this URL via urllib.request.urlretrieve.
 */

import { createClient } from "@supabase/supabase-js";
import { resolvePolyHavenModelDownloadUrl } from "@/lib/polyhaven/client";

const USER_AGENT = "GrandStudio/1.0";

function polyHavenUrlMatchesAssetId(url: string, assetId: string): boolean {
  try {
    const path = new URL(url).pathname;
    return (
      path.includes(`/${assetId}/`) ||
      path.includes(`/${assetId}_`) ||
      path.endsWith(`/${assetId}.glb`) ||
      path.endsWith(`/${assetId}.fbx`)
    );
  } catch {
    return url.includes(assetId);
  }
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase credentials");
  return createClient(url, key);
}

/**
 * 1) Check downloaded_assets cache for existing direct URL
 * 2) GET api.polyhaven.com/files/ASSET_ID
 * 3) Prefer GLB, then FBX — get direct download URL (no glTF — needs separate .bin)
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

  if (existing?.storage_url && polyHavenUrlMatchesAssetId(existing.storage_url, assetId)) {
    return existing.storage_url;
  }
  if (existing?.storage_url) {
    console.warn(
      "[polyhaven] Ignoring cached URL for",
      assetId,
      "(path does not match asset id); re-resolving from API"
    );
  }

  const filesRes = await fetch(`https://api.polyhaven.com/files/${assetId}`, {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
  });
  if (!filesRes.ok) return null;

  const filesData = (await filesRes.json()) as Record<string, unknown>;
  const resolved = resolvePolyHavenModelDownloadUrl(filesData, "1k");
  if (!resolved) return null;
  const downloadUrl = resolved.url;
  const ext = resolved.format;

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
