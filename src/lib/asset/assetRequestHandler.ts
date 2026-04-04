/**
 * Handles direct asset import requests (e.g. "import a rock from Poly Haven").
 * Bypasses the AI and directly searches, downloads, and generates UE5 import code.
 */

import { searchAssets } from "@/lib/polyhaven/client";
import { downloadPolyHavenModelToStorage } from "@/lib/polyhaven/downloadToSupabase";
import { searchModels as searchSketchfab, getDownloadUrl as getSketchfabDownloadUrl } from "@/lib/sketchfab/client";
import { createServerClient } from "@/lib/supabase/server";
import {
  buildPolyHavenDiffuseFollowUpPython,
  generateUE5ImportCode,
  generateSketchfabImportCode,
  UE5_IMPORT_DESTINATION_PATH,
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

async function downloadPolyHavenToSupabase(assetId: string) {
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
  let polyDiffuseUrl: string | null = null;
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
      const polyBundle = await downloadPolyHavenToSupabase(best.id);
      storageUrl = polyBundle?.meshUrl ?? null;
      polyDiffuseUrl = polyBundle?.diffuseUrl ?? null;
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
          const stem = assetName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "_");
          const filename = polyHavenAssetId ? `${stem}.fbx` : `${stem}.${storageUrl!.split("?")[0].toLowerCase().endsWith(".glb") ? "glb" : "fbx"}`;
          return generateUE5ImportCode(
            storageUrl!,
            filename,
            label,
            polyHavenAssetId
              ? {
                  traceAssetId: polyHavenAssetId,
                  destinationName: polyHavenAssetId.replace(/[^a-zA-Z0-9_]/g, "_"),
                  textureUrl: polyDiffuseUrl,
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

  const imports: { url: string; label: string; index: number; diffuseUrl: string | null }[] = [];
  let index = 0;

  for (const query of searchQueries) {
    try {
      const results = await searchAssets(query, "models", 1);
      if (results.length === 0) continue;

      const asset = results[0];
      const bundle = await downloadPolyHavenToSupabase(asset.id);
      if (bundle?.meshUrl) {
        const label = `${asset.name.replace(/\s+/g, "_")}_${index}`;
        imports.push({ url: bundle.meshUrl, label, index, diffuseUrl: bundle.diffuseUrl });
        index++;
      }
    } catch (e) {
      console.warn(`[enrichCode] Failed to add ${query}:`, e);
    }
  }

  if (imports.length === 0) return code;

  const destPy = UE5_IMPORT_DESTINATION_PATH.replace(/'/g, "\\'");

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
    const filename = `${imp.label}.fbx`;
    const localPath = `C:/GrandStudio/Downloads/${filename}`;
    const destName = imp.label.replace(/[^a-zA-Z0-9_]/g, "_") || "imported_mesh";
    const escapedUrl = imp.url.replace(/'/g, "\\'");
    const escapedLocal = localPath.replace(/'/g, "\\'");
    const escapedDest = destName.replace(/'/g, "\\'");
    const diffusePy =
      imp.diffuseUrl != null && imp.diffuseUrl.length > 0
        ? buildPolyHavenDiffuseFollowUpPython(imp.diffuseUrl, destName)
            .split("\n")
            .map((line) => (line.trim() === "" ? "" : `    ${line}`))
            .join("\n")
        : "";
    importLines.push(
      `try:`,
      `    urllib.request.urlretrieve('${escapedUrl}', '${escapedLocal}')`,
      `    task = unreal.AssetImportTask()`,
      `    task.filename = '${escapedLocal}'`,
      `    task.destination_path = '${destPy}'`,
      `    task.destination_name = '${escapedDest}'`,
      `    task.replace_existing = True`,
      `    task.automated = True`,
      `    task.save = True`,
      `    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])`,
      `    unreal.log('Imported ${escapedDest}')`,
      ...(diffusePy ? [diffusePy] : []),
      `except Exception as e:`,
      `    unreal.log_warning(f'Poly Haven import failed: {e}')`,
      ``
    );
  }

  const importCode = importLines.join("\n");
  return code.trimEnd() + "\n\n" + importCode;
}
