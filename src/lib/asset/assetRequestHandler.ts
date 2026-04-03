/**
 * Handles direct asset import requests (e.g. "import a rock from Poly Haven").
 * Bypasses the AI and directly searches, downloads, and generates UE5 import code.
 */

import { searchAssets } from "@/lib/polyhaven/client";
import { downloadPolyHavenModelToStorage } from "@/lib/polyhaven/downloadToSupabase";
import { searchModels as searchSketchfab, getDownloadUrl as getSketchfabDownloadUrl } from "@/lib/sketchfab/client";
import { createServerClient } from "@/lib/supabase/server";
import {
  generateUE5ImportCode,
  generateSketchfabImportCode,
  UE5_IMPORT_MESH_DESTINATION_PATH,
  pythonPostImportValidationAndMaterialFallbackForLabel,
} from "@/lib/ue5/importCode";

export interface AssetRequestResult {
  chatMessage: string;
  importCode: string;
  assetName: string;
  /** Which platform was used for usage tracking. */
  platformUsed?: "polyhaven" | "sketchfab";
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

const STOPWORDS = new Set([
  "ok", "okay", "lets", "let's", "search", "import", "that", "this", "from", "a", "an", "the", "and", "me", "please", "find", "get", "for", "it", "to", "in", "on", "with", "can", "you", "could", "would", "want", "need", "just", "like", "something",
]);

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
    .replace(/\s+/g, " ")
    .trim();
  const words = text.split(" ").filter(Boolean);
  const content = words.filter((w) => !STOPWORDS.has(w.toLowerCase()));
  const query = content.join(" ").trim();
  return query || "model";
}

async function downloadPolyHavenToSupabase(assetId: string): Promise<string | null> {
  return downloadPolyHavenModelToStorage(assetId);
}

async function downloadSketchfabToSupabase(uid: string): Promise<string | null> {
  const token = process.env.SKETCHFAB_API_TOKEN;
  if (!token) return null;

  const supabase = createServerClient();

  const downloadUrl = await getSketchfabDownloadUrl(uid, token);
  if (!downloadUrl) return null;

  const ext = downloadUrl.toLowerCase().includes(".glb") ? "glb" : "zip";
  await supabase.from("downloaded_assets").upsert(
    {
      source: "sketchfab",
      source_id: uid,
      name: uid,
      storage_url: downloadUrl,
      format: ext,
      file_size_bytes: 0,
      license: "CC-BY",
    },
    { onConflict: "source,source_id" }
  );
  return downloadUrl;
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
  let polyHavenAssetId: string | null = null;

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
        polyHavenAssetId = best.id;
      }
    }
  }

  let sketchfabUid: string | null = null;
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
          sketchfabUid = best.uid;
        }
      }
    }
  }

  if (!storageUrl) {
    console.log("[handleAssetRequest] No storage URL after search — returning null");
    return null;
  }

  const label = assetName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "_");
  const importCode =
    sourceLabel === "Sketchfab" && sketchfabUid
      ? generateSketchfabImportCode(storageUrl, `${sketchfabUid}.zip`, label, {
          traceAssetId: sketchfabUid,
          destinationName: `sf_${sketchfabUid}`,
        })
      : (() => {
          const phPath = storageUrl!.split("?")[0].split("#")[0].toLowerCase();
          const ext = phPath.endsWith(".glb") ? "glb" : "fbx";
          const filename = `${assetName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "_")}.${ext}`;
          return generateUE5ImportCode(
            storageUrl!,
            filename,
            label,
            polyHavenAssetId
              ? {
                  traceAssetId: polyHavenAssetId,
                  destinationName: polyHavenAssetId.replace(/[^a-zA-Z0-9_]/g, "_"),
                }
              : undefined
          );
        })();
  const chatMessage = `Found ${assetName} in our library! Importing to your UE5 scene now… ✨`;

  const platformUsed = sourceLabel === "Poly Haven" ? "polyhaven" : sourceLabel === "Sketchfab" ? "sketchfab" : undefined;
  console.log("[handleAssetRequest] Success — returning chatMessage + importCode");
  return { chatMessage, importCode, assetName, platformUsed };
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

  const meshDestPy = UE5_IMPORT_MESH_DESTINATION_PATH.replace(/'/g, "\\'");

  const importLines: string[] = [
    "# --- Auto-added Poly Haven assets ---",
    "import unreal",
    "import urllib.request",
    "import os",
    "import json",
    "",
    "download_dir = 'C:/GrandStudio/Downloads'",
    "os.makedirs(download_dir, exist_ok=True)",
    `try:`,
    `    unreal.EditorAssetLibrary.make_directory('${meshDestPy}')`,
    `except Exception:`,
    `    pass`,
    "",
  ];

  for (const imp of imports) {
    const phPath = imp.url.split("?")[0].split("#")[0].toLowerCase();
    const ext = phPath.endsWith(".glb") ? "glb" : "fbx";
    const filename = `${imp.label}.${ext}`;
    const localPath = `C:/GrandStudio/Downloads/${filename}`;
    const destName = imp.label.replace(/[^a-zA-Z0-9_]/g, "_") || "imported_mesh";
    const postImport = pythonPostImportValidationAndMaterialFallbackForLabel(imp.label, undefined, destName)
      .trim()
      .split("\n")
      .map((l) => `    ${l}`)
      .join("\n");
    importLines.push(
      `try:`,
      `    urllib.request.urlretrieve('${imp.url}', '${localPath}')`,
      `    task = unreal.AssetImportTask()`,
      `    task.set_editor_property('filename', '${localPath}')`,
      `    task.set_editor_property('destination_path', '${meshDestPy}')`,
      `    task.set_editor_property('destination_name', '${destName}')`,
      `    task.set_editor_property('replace_existing', True)`,
      `    task.set_editor_property('automated', True)`,
      `    task.set_editor_property('save', True)`,
      `    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])`,
      `    imported_paths = task.get_editor_property('imported_object_paths')`,
      postImport,
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
