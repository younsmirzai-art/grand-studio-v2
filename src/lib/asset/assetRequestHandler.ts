/**
 * Handles direct asset import requests (e.g. "import a rock from Poly Haven").
 * Bypasses the AI and directly searches, downloads, and generates UE5 import code.
 */

import { searchAssets } from "@/lib/polyhaven/client";
import { downloadPolyHavenModelToStorage } from "@/lib/polyhaven/downloadToSupabase";
import { searchModels as searchSketchfab, getDownloadUrl as getSketchfabDownloadUrl } from "@/lib/sketchfab/client";
import { createServerClient } from "@/lib/supabase/server";
import { combineLocalImportFragments } from "@/lib/ai/assetResolver";
import {
  diffuseFileExtensionFromUrl,
  generateSketchfabLocalImportCode,
  generateUE5ImportCode,
} from "@/lib/ue5/importCode";
import { queueRelayDownloadCommand } from "@/lib/ue5/commands";
import type { RelayDownloadContext } from "@/lib/ue5/relayDownload";
import { waitForUE5CommandStatus } from "@/lib/ue5/relayDownload";

export interface AssetRequestResult {
  chatMessage: string;
  importCode: string;
  assetName: string;
  /** Which platform was used for usage tracking. */
  platformUsed?: "polyhaven" | "sketchfab";
  /** When set, callers should queue relay download before the import UE command. */
  relayDownload?: RelayDownloadContext;
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
  let importCode: string;
  let relayDownload: RelayDownloadContext | undefined;

  if (sourceLabel === "Sketchfab" && sketchfabUid) {
    const importStem = `sf_${sketchfabUid}`;
    relayDownload = {
      kind: "sketchfab_zip",
      url: storageUrl,
      filename: `${sketchfabUid}.zip`,
      importStem,
    };
    importCode = generateSketchfabLocalImportCode(importStem, label, {
      traceAssetId: sketchfabUid,
      destinationName: importStem,
    });
  } else {
    const stem = assetName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = polyHavenAssetId
      ? `${stem}.fbx`
      : `${stem}.${storageUrl!.split("?")[0].toLowerCase().endsWith(".glb") ? "glb" : "fbx"}`;
    const destName = polyHavenAssetId
      ? polyHavenAssetId.replace(/[^a-zA-Z0-9_]/g, "_")
      : stem.replace(/[^a-zA-Z0-9_]/g, "_");
    const diffuseExt =
      polyDiffuseUrl != null && polyDiffuseUrl.length > 0
        ? diffuseFileExtensionFromUrl(polyDiffuseUrl)
        : "jpg";
    const diffuseFilename =
      polyDiffuseUrl != null && polyDiffuseUrl.length > 0
        ? `${destName}_diffuse.${diffuseExt}`
        : undefined;
    relayDownload =
      polyHavenAssetId != null
        ? {
            kind: "polyhaven_fbx",
            url: storageUrl,
            filename,
            diffuseUrl: polyDiffuseUrl ?? undefined,
            diffuseFilename,
          }
        : {
            kind: "http_mesh",
            url: storageUrl,
            filename,
          };
    importCode = generateUE5ImportCode(storageUrl, filename, label, {
      traceAssetId: polyHavenAssetId ?? undefined,
      destinationName: destName,
      diffuseDiskFilename: diffuseFilename,
    });
  }

  const chatMessage = `Found ${assetName} in our library! Importing to your UE5 scene now… ✨`;

  const platformUsed = sourceLabel === "Poly Haven" ? "polyhaven" : sourceLabel === "Sketchfab" ? "sketchfab" : undefined;
  console.log("[handleAssetRequest] Success — returning chatMessage + importCode");
  return { chatMessage, importCode, assetName, platformUsed, relayDownload };
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
  userPrompt: string,
  projectId?: string
): Promise<string> {
  if (!usesOnlyBasicShapes(code)) return code;
  if (!projectId) return code;

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

  const fragments: string[] = [];
  for (const imp of imports) {
    const destName = imp.label.replace(/[^a-zA-Z0-9_]/g, "_") || "imported_mesh";
    const safeLabel = imp.label.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const filename = `${safeLabel}.fbx`;
    const diffuseExt =
      imp.diffuseUrl != null && imp.diffuseUrl.length > 0
        ? diffuseFileExtensionFromUrl(imp.diffuseUrl)
        : "jpg";
    const diffuseFilename =
      imp.diffuseUrl != null && imp.diffuseUrl.length > 0
        ? `${destName}_diffuse.${diffuseExt}`
        : undefined;

    try {
      const dlId = await queueRelayDownloadCommand(projectId, {
        kind: "polyhaven_fbx",
        url: imp.url,
        filename,
        diffuseUrl: imp.diffuseUrl ?? undefined,
        diffuseFilename,
      });
      const st = await waitForUE5CommandStatus(dlId, 600_000);
      if (st !== "success") continue;
    } catch (e) {
      console.warn(`[enrichCode] Relay download failed for ${imp.label}:`, e);
      continue;
    }

    fragments.push(
      generateUE5ImportCode(imp.url, filename, imp.label, {
        destinationName: destName,
        diffuseDiskFilename: diffuseFilename,
      })
    );
  }

  if (fragments.length === 0) return code;
  const importCode = combineLocalImportFragments(fragments);
  return code.trimEnd() + "\n\n" + importCode;
}
