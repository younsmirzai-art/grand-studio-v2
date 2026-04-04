/**
 * Handles direct asset import requests (e.g. "import a rock from Poly Haven").
 * Returns a chat hint only — models are prepared via workspace downloads, not a remote relay.
 */

import { searchAssets } from "@/lib/polyhaven/client";
import { downloadPolyHavenModelToStorage } from "@/lib/polyhaven/downloadToSupabase";
import { searchModels as searchSketchfab } from "@/lib/sketchfab/client";

export interface AssetRequestResult {
  chatMessage: string;
  importCode: string;
  assetName: string;
  platformUsed?: "polyhaven" | "sketchfab";
}

/** @deprecated Relay removed; always undefined in responses. */
export type RelayDownloadContext = never;

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
  "ok",
  "okay",
  "lets",
  "let's",
  "search",
  "import",
  "that",
  "this",
  "from",
  "a",
  "an",
  "the",
  "and",
  "me",
  "please",
  "find",
  "get",
  "for",
  "it",
  "to",
  "in",
  "on",
  "with",
  "can",
  "you",
  "could",
  "would",
  "want",
  "need",
  "just",
  "like",
  "something",
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

export async function handleAssetRequest(message: string, _projectId: string): Promise<AssetRequestResult | null> {
  const detected = detectAssetImportRequest(message);
  if (!detected) {
    console.log("[handleAssetRequest] detectAssetImportRequest returned null");
    return null;
  }

  const { platform, query } = detected;
  console.log("[handleAssetRequest] Searching for platform:", platform, "query:", query);

  let assetName = query;
  let sourceLabel = "";

  if (platform === "polyhaven" || platform === "both") {
    const results = await searchAssets(query, "models", 5);
    if (results.length > 0) {
      const best = results[0];
      const polyBundle = await downloadPolyHavenModelToStorage(best.id);
      if (polyBundle?.meshUrl) {
        assetName = best.name;
        sourceLabel = "Poly Haven";
      }
    }
  }

  if (!sourceLabel && (platform === "sketchfab" || platform === "both")) {
    const token = process.env.SKETCHFAB_API_TOKEN;
    if (token) {
      const results = await searchSketchfab(query, { count: 5, token });
      if (results.length > 0) {
        assetName = results[0].name;
        sourceLabel = "Sketchfab";
      }
    }
  }

  if (!sourceLabel) {
    console.log("[handleAssetRequest] No match — returning null");
    return null;
  }

  const chatMessage = `Found **${assetName}** (${sourceLabel}). Open the **3D Library** tab in the workspace, search for it, and use **Import** to download a package for Unreal.`;

  const platformUsed = sourceLabel === "Poly Haven" ? "polyhaven" : "sketchfab";
  return { chatMessage, importCode: "", assetName, platformUsed };
}

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

/** Relay-based enrichment removed; returns code unchanged. */
export async function enrichCodeWithPolyHavenAssets(
  code: string,
  userPrompt: string,
  _projectId?: string
): Promise<string> {
  if (!usesOnlyBasicShapes(code)) return code;
  const lower = userPrompt.toLowerCase();
  const hit = ENRICH_KEYWORDS.some(({ keyword }) => lower.includes(keyword));
  if (hit) {
    console.info("[enrichCode] Skipped auto Poly Haven relay imports (relay removed).");
  }
  return code;
}
