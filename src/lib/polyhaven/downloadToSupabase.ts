/**
 * Resolve direct Poly Haven model download URL (no Supabase upload).
 * UE5 Python code downloads directly from this URL via urllib.request.urlretrieve.
 */

import { createClient } from "@supabase/supabase-js";
import { pickPolyHavenDiffuseUrl, resolvePolyHavenModelDownloadUrl } from "@/lib/polyhaven/client";

const USER_AGENT = "GrandStudio/1.0";

export type PolyHavenModelDownloadBundle = {
  meshUrl: string;
  diffuseUrl: string | null;
};

function polyHavenUrlMatchesAssetId(url: string, assetId: string): boolean {
  try {
    const path = new URL(url).pathname;
    return (
      path.includes(`/${assetId}/`) ||
      path.includes(`/${assetId}_`) ||
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

async function fetchPolyHavenFilesJson(assetId: string): Promise<Record<string, unknown> | null> {
  const filesRes = await fetch(`https://api.polyhaven.com/files/${assetId}`, {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
  });
  if (!filesRes.ok) return null;
  return (await filesRes.json()) as Record<string, unknown>;
}

/**
 * 1) Check downloaded_assets cache for existing direct mesh URL
 * 2) GET api.polyhaven.com/files/ASSET_ID (always, to resolve Diffuse when possible)
 * 3) Resolve FBX + optional Diffuse from /files payload
 * 4) Cache the mesh URL in downloaded_assets (no file upload)
 * 5) Return mesh URL + optional diffuse URL for UE5 import code
 */
export async function downloadPolyHavenModelToStorage(assetId: string): Promise<PolyHavenModelDownloadBundle | null> {
  const supabase = getSupabase();

  const { data: existing } = await supabase
    .from("downloaded_assets")
    .select("storage_url")
    .eq("source", "polyhaven")
    .eq("source_id", assetId)
    .maybeSingle();

  if (existing?.storage_url && polyHavenUrlMatchesAssetId(existing.storage_url, assetId)) {
    const filesData = await fetchPolyHavenFilesJson(assetId);
    const diffuseUrl = filesData ? pickPolyHavenDiffuseUrl(filesData, "1k") : null;
    return { meshUrl: existing.storage_url, diffuseUrl };
  }
  if (existing?.storage_url) {
    console.warn(
      "[polyhaven] Ignoring cached URL for",
      assetId,
      "(path does not match asset id); re-resolving from API"
    );
  }

  const filesData = await fetchPolyHavenFilesJson(assetId);
  if (!filesData) return null;
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
  return { meshUrl: downloadUrl, diffuseUrl: resolved.diffuseUrl };
}
