/**
 * Handles direct asset import requests (e.g. "import a rock from Poly Haven").
 * Bypasses the AI and directly searches, downloads, and generates UE5 import code.
 */

import { searchAssets, getModelDownloadUrl } from "@/lib/polyhaven/client";
import { searchModels as searchSketchfab, getDownloadUrl as getSketchfabDownloadUrl } from "@/lib/sketchfab/client";
import { createServerClient } from "@/lib/supabase/server";
import { generateUE5ImportCode } from "@/lib/ue5/importCode";

export interface AssetRequestResult {
  chatMessage: string;
  importCode: string;
  assetName: string;
}

/** Detect if message is an asset import request and extract platform + query. */
export function detectAssetImportRequest(message: string): {
  isImport: boolean;
  platform: "polyhaven" | "sketchfab" | "both";
  query: string;
} | null {
  const lower = message.trim().toLowerCase();

  const hasPolyHaven =
    lower.includes("from poly haven") ||
    lower.includes("from polyhaven") ||
    lower.includes("poly haven") ||
    lower.includes("polyhaven");

  const hasSketchfab =
    lower.includes("from sketchfab") ||
    lower.includes("sketchfab") ||
    lower.includes("from sketch fab");

  const hasImport =
    lower.includes("import") ||
    lower.includes("get ") ||
    lower.includes("get me") ||
    lower.includes("fetch") ||
    lower.includes("download");

  const isImportRequest = hasImport || hasPolyHaven || hasSketchfab;
  if (!isImportRequest) return null;

  let platform: "polyhaven" | "sketchfab" | "both" = "both";
  if (hasPolyHaven && !hasSketchfab) platform = "polyhaven";
  else if (hasSketchfab && !hasPolyHaven) platform = "sketchfab";

  const query = extractObjectQuery(message, hasPolyHaven, hasSketchfab);
  if (!query || query.length < 1) return null;

  return { isImport: true, platform, query };
}

function extractObjectQuery(message: string, hasPolyHaven: boolean, hasSketchfab: boolean): string {
  let text = message
    .replace(/from\s+poly\s+haven/gi, "")
    .replace(/from\s+polyhaven/gi, "")
    .replace(/poly\s+haven/gi, "")
    .replace(/from\s+sketchfab/gi, "")
    .replace(/from\s+sketch\s+fab/gi, "")
    .replace(/sketchfab/gi, "")
    .replace(/import\s+/gi, " ")
    .replace(/get\s+me\s+/gi, " ")
    .replace(/get\s+/gi, " ")
    .replace(/fetch\s+/gi, " ")
    .replace(/download\s+/gi, " ")
    .replace(/a\s+/gi, " ")
    .replace(/an\s+/gi, " ")
    .replace(/the\s+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || "model";
}

async function downloadPolyHavenToSupabase(assetId: string): Promise<string | null> {
  const supabase = createServerClient();

  const { data: existing } = await supabase
    .from("downloaded_assets")
    .select("storage_url")
    .eq("source", "polyhaven")
    .eq("source_id", assetId)
    .maybeSingle();

  if (existing?.storage_url) {
    console.log("[handleAssetRequest] downloadPolyHavenToSupabase: cached", assetId);
    return existing.storage_url;
  }

  console.log("[handleAssetRequest] downloadPolyHavenToSupabase: fetching download URL for", assetId);
  const downloadUrl = await getModelDownloadUrl(assetId, "1k");
  if (!downloadUrl) {
    console.log("[handleAssetRequest] downloadPolyHavenToSupabase: no download URL for", assetId);
    return null;
  }
  console.log("[handleAssetRequest] downloadPolyHavenToSupabase: got URL, downloading file");

  const fileRes = await fetch(downloadUrl);
  if (!fileRes.ok) {
    console.log("[handleAssetRequest] downloadPolyHavenToSupabase: fetch failed", fileRes.status);
    return null;
  }

  const blob = await fileRes.blob();
  const ext = downloadUrl.includes(".glb") ? "glb" : "gltf";
  const storagePath = `polyhaven/${assetId}.${ext}`;

  const { error } = await supabase.storage
    .from("polyhaven-assets")
    .upload(storagePath, blob, {
      contentType: blob.type || "application/octet-stream",
      upsert: true,
    });

  if (error) {
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
  console.log("[handleAssetRequest] downloadPolyHavenToSupabase: uploaded to Supabase", assetId);
  return publicUrl.publicUrl;
}

async function downloadSketchfabToSupabase(uid: string): Promise<string | null> {
  const token = process.env.SKETCHFAB_API_TOKEN;
  if (!token) return null;

  const supabase = createServerClient();

  const { data: existing } = await supabase
    .from("downloaded_assets")
    .select("storage_url")
    .eq("source", "sketchfab")
    .eq("source_id", uid)
    .maybeSingle();

  if (existing?.storage_url) return existing.storage_url;

  const downloadUrl = await getSketchfabDownloadUrl(uid, token);
  if (!downloadUrl) return null;

  const fileRes = await fetch(downloadUrl);
  if (!fileRes.ok) return null;

  const blob = await fileRes.blob();
  const ext = downloadUrl.includes(".glb") ? "glb" : "gltf";
  const storagePath = `sketchfab/${uid}.${ext}`;

  const { error } = await supabase.storage
    .from("sketchfab-assets")
    .upload(storagePath, blob, {
      contentType: blob.type || "application/octet-stream",
      upsert: true,
    });

  if (error) return null;

  const { data: publicUrl } = supabase.storage.from("sketchfab-assets").getPublicUrl(storagePath);
  await supabase.from("downloaded_assets").upsert(
    {
      source: "sketchfab",
      source_id: uid,
      name: uid,
      storage_url: publicUrl.publicUrl,
      format: ext,
      file_size_bytes: blob.size,
      license: "CC-BY",
    },
    { onConflict: "source,source_id" }
  );
  return publicUrl.publicUrl;
}


/**
 * Handle direct asset import request. Returns chat message + import code, or null if failed.
 */
export async function handleAssetRequest(
  message: string,
  _projectId: string
): Promise<AssetRequestResult | null> {
  const detected = detectAssetImportRequest(message);
  if (!detected) {
    console.log("[handleAssetRequest] detectAssetImportRequest returned null");
    return null;
  }

  const { platform, query } = detected;
  console.log("[handleAssetRequest] Searching for platform:", platform, "query:", query);

  let storageUrl: string | null = null;
  let assetName = query;
  let sourceLabel = "";

  if (platform === "polyhaven" || platform === "both") {
    console.log("[handleAssetRequest] Searching Poly Haven for query:", query);
    const results = await searchAssets(query, "models", 5);
    console.log("[handleAssetRequest] Poly Haven found results:", results.length, results[0]?.id ?? "none");
    if (results.length > 0) {
      const best = results[0];
      console.log("[handleAssetRequest] Best result:", best.id, best.name);
      storageUrl = await downloadPolyHavenToSupabase(best.id);
      console.log("[handleAssetRequest] Download URL (Poly Haven):", storageUrl ? "yes" : "no");
      if (storageUrl) {
        assetName = best.name;
        sourceLabel = "Poly Haven";
      }
    }
  }

  if (!storageUrl && (platform === "sketchfab" || platform === "both")) {
    const token = process.env.SKETCHFAB_API_TOKEN;
    console.log("[handleAssetRequest] Sketchfab token present:", !!token);
    if (token) {
      console.log("[handleAssetRequest] Searching Sketchfab for query:", query);
      const results = await searchSketchfab(query, { count: 5, token });
      console.log("[handleAssetRequest] Sketchfab found results:", results.length);
      if (results.length > 0) {
        const best = results[0];
        storageUrl = await downloadSketchfabToSupabase(best.uid);
        if (storageUrl) {
          assetName = best.name;
          sourceLabel = "Sketchfab";
        }
      }
    }
  }

  if (!storageUrl) {
    console.log("[handleAssetRequest] No storage URL after search — returning null");
    return null;
  }

  const ext = storageUrl.endsWith(".glb") ? "glb" : "gltf";
  const filename = `${assetName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "_")}.${ext}`;
  const label = assetName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "_");
  const importCode = generateUE5ImportCode(storageUrl, filename, label);
  const chatMessage = sourceLabel
    ? `Found ${assetName} on ${sourceLabel}! Importing to your UE5 scene now… ✨`
    : `Found ${assetName}! Importing to your UE5 scene now… ✨`;

  console.log("[handleAssetRequest] Success — returning chatMessage + importCode");
  return { chatMessage, importCode, assetName };
}

/** Keywords that suggest we should add Poly Haven assets when code uses BasicShapes. */
const ENRICH_KEYWORDS: { keyword: string; searchQuery: string }[] = [
  { keyword: "forest", searchQuery: "tree" },
  { keyword: "trees", searchQuery: "tree" },
  { keyword: "tree", searchQuery: "tree" },
  { keyword: "rocks", searchQuery: "rock" },
  { keyword: "rock", searchQuery: "rock" },
  { keyword: "bushes", searchQuery: "bush" },
  { keyword: "bush", searchQuery: "bush" },
  { keyword: "vegetation", searchQuery: "plant" },
  { keyword: "plants", searchQuery: "plant" },
];

/** Check if code uses only BasicShapes (no Starter Content). */
function usesOnlyBasicShapes(code: string): boolean {
  if (code.includes("/Game/StarterContent/")) return false;
  return (
    code.includes("BasicShapes/Cube") ||
    code.includes("BasicShapes/Sphere") ||
    code.includes("BasicShapes/Cylinder") ||
    code.includes("BasicShapes/Cone") ||
    code.includes("BasicShapes/Plane")
  );
}

/**
 * When AI code uses only BasicShapes and the prompt suggests trees/rocks/etc,
 * add Poly Haven imports for real assets.
 */
export async function enrichCodeWithPolyHavenAssets(
  code: string,
  userPrompt: string
): Promise<string> {
  if (!usesOnlyBasicShapes(code)) return code;

  const lower = userPrompt.toLowerCase();
  const searchQueries = new Set<string>();
  for (const { keyword, searchQuery } of ENRICH_KEYWORDS) {
    if (lower.includes(keyword)) searchQueries.add(searchQuery);
  }
  if (searchQueries.size === 0) return code;

  const imports: { url: string; label: string; index: number }[] = [];
  let index = 0;

  for (const query of searchQueries) {
    try {
      const results = await searchAssets(query, "models", 1);
      if (results.length === 0) continue;

      const asset = results[0];
      const storageUrl = await downloadPolyHavenToSupabase(asset.id);
      if (storageUrl) {
        const label = `${asset.name.replace(/\s+/g, "_")}_${index}`;
        imports.push({ url: storageUrl, label, index });
        index++;
      }
    } catch (e) {
      console.warn(`[enrichCode] Failed to add ${query}:`, e);
    }
  }

  if (imports.length === 0) return code;

  const importLines: string[] = [
    "# --- Auto-added Poly Haven assets ---",
    "import unreal",
    "import urllib.request",
    "import os",
    "",
    "download_dir = 'C:/GrandStudio/Downloads'",
    "os.makedirs(download_dir, exist_ok=True)",
    "",
  ];

  for (const imp of imports) {
    const ext = imp.url.endsWith(".glb") ? "glb" : "gltf";
    const filename = `${imp.label}.${ext}`;
    const localPath = `C:/GrandStudio/Downloads/${filename}`;
    const ue5Path = `/Game/GrandStudio/Imports/${imp.label}`;
    importLines.push(
      `try:`,
      `    urllib.request.urlretrieve('${imp.url}', '${localPath}')`,
      `    task = unreal.AssetImportTask()`,
      `    task.set_editor_property('filename', '${localPath}')`,
      `    task.set_editor_property('destination_path', '${ue5Path}')`,
      `    task.set_editor_property('automated', True)`,
      `    task.set_editor_property('save', True)`,
      `    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])`,
      `    paths = task.get_editor_property('imported_object_paths')`,
      `    if paths and len(paths) > 0:`,
      `        asset = unreal.EditorAssetLibrary.load_asset(str(paths[0]))`,
      `        if asset:`,
      `            unreal.EditorLevelLibrary.spawn_actor_from_object(asset, unreal.Vector(${imp.index * 300}, 0, 0))`,
      `except Exception as e:`,
      `    unreal.log_warning(f'Poly Haven import failed: {e}')`,
      ``
    );
  }

  const importCode = importLines.join("\n");
  return code.trimEnd() + "\n\n" + importCode;
}
