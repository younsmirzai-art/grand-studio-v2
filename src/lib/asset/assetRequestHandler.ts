/**
 * Handles direct asset import requests (e.g. "import a rock from Poly Haven").
 * Bypasses the AI and directly searches, downloads, and generates UE5 import code.
 */

import { searchAssets } from "@/lib/polyhaven/client";
import { searchModels as searchSketchfab, getDownloadUrl as getSketchfabDownloadUrl } from "@/lib/sketchfab/client";
import { getModelDownloadUrl } from "@/lib/polyhaven/client";
import { createServerClient } from "@/lib/supabase/server";

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

  if (!hasImport && !hasPolyHaven && !hasSketchfab) return null;

  let platform: "polyhaven" | "sketchfab" | "both" = "both";
  if (hasPolyHaven && !hasSketchfab) platform = "polyhaven";
  else if (hasSketchfab && !hasPolyHaven) platform = "sketchfab";

  const query = extractObjectQuery(message, hasPolyHaven, hasSketchfab);
  if (!query || query.length < 2) return null;

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

  if (existing?.storage_url) return existing.storage_url;

  const downloadUrl = await getModelDownloadUrl(assetId, "1k");
  if (!downloadUrl) return null;

  const fileRes = await fetch(downloadUrl);
  if (!fileRes.ok) return null;

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

function generateImportPythonCode(
  storageUrl: string,
  label: string,
  position = "0,0,0",
  scale = "1"
): string {
  const ext = storageUrl.endsWith(".glb") ? "glb" : "gltf";
  const safeLabel = label.replace(/[^a-zA-Z0-9_]/g, "_");
  const filename = `${safeLabel}.${ext}`;
  const localPath = `C:/GrandStudio/Downloads/${filename}`;
  const ue5Path = `/Game/GrandStudio/Imports/${safeLabel}`;

  const [x, y, z] = position.split(",").map((s) => s.trim());
  const scaleVal = parseFloat(scale) || 1;

  return `import unreal
import urllib.request
import os

download_dir = 'C:/GrandStudio/Downloads'
os.makedirs(download_dir, exist_ok=True)

try:
    local_file = '${localPath}'
    urllib.request.urlretrieve('${storageUrl}', local_file)
    unreal.log('Downloaded: ${filename}')

    task = unreal.AssetImportTask()
    task.set_editor_property('filename', local_file)
    task.set_editor_property('destination_path', '${ue5Path}')
    task.set_editor_property('automated', True)
    task.set_editor_property('save', True)
    task.set_editor_property('replace_existing', True)
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])

    imported_paths = task.get_editor_property('imported_object_paths')
    if imported_paths and len(imported_paths) > 0:
        asset_path = str(imported_paths[0])
        asset = unreal.EditorAssetLibrary.load_asset(asset_path)
        if asset:
            editor = unreal.EditorLevelLibrary
            pos = unreal.Vector(${x || "0"}, ${y || "0"}, ${z || "0"})
            actor = editor.spawn_actor_from_object(asset, pos)
            if actor:
                actor.set_actor_scale3d(unreal.Vector(${scaleVal}, ${scaleVal}, ${scaleVal}))
                actor.set_actor_label('${safeLabel}')
                unreal.log('Imported and placed: ${safeLabel}')
    else:
        unreal.log_warning('Import completed but no assets returned')
except Exception as e:
    unreal.log_warning(f'Import failed: {e}')
`;
}

/**
 * Handle direct asset import request. Returns chat message + import code, or null if failed.
 */
export async function handleAssetRequest(
  message: string,
  _projectId: string
): Promise<AssetRequestResult | null> {
  const detected = detectAssetImportRequest(message);
  if (!detected) return null;

  const { platform, query } = detected;
  let storageUrl: string | null = null;
  let assetName = query;
  let sourceLabel = "";

  if (platform === "polyhaven" || platform === "both") {
    const results = await searchAssets(query, "models", 5);
    if (results.length > 0) {
      const best = results[0];
      storageUrl = await downloadPolyHavenToSupabase(best.id);
      if (storageUrl) {
        assetName = best.name;
        sourceLabel = "Poly Haven";
      }
    }
  }

  if (!storageUrl && (platform === "sketchfab" || platform === "both")) {
    const token = process.env.SKETCHFAB_API_TOKEN;
    if (token) {
      const results = await searchSketchfab(query, { count: 5, token });
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

  if (!storageUrl) return null;

  const importCode = generateImportPythonCode(storageUrl, assetName.replace(/\s+/g, "_"));
  const chatMessage = sourceLabel
    ? `Found a great model on ${sourceLabel}! Importing "${assetName}" to your scene now… ✨`
    : `Found a great model! Importing "${assetName}" to your scene now… ✨`;

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
