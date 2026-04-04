import { handleAssetRequest } from "@/lib/asset/assetRequestHandler";
import { runSequentialLibraryImports, MAX_IMPORTS_PER_STEP } from "@/lib/ai/libraryImportRunner";
import type { ImportProgressEvent } from "@/lib/ai/agentImportTypes";

export type { ImportProgressEvent } from "@/lib/ai/agentImportTypes";
export { detectEnvironment } from "@/lib/ai/assetResolver2-queries";

export type ScannedAsset = { path?: string; name?: string; type?: string };

/** Target library imports per step (capped at MAX_IMPORTS_PER_STEP in runner). */
export function getImportCountForAction(action: string): number {
  const a = action.toLowerCase();
  const map: Record<string, number> = {
    load_landscape: 2,
    place_buildings: 5,
    place_trees: 5,
    place_walls: 5,
    place_vehicles: 5,
    add_lighting: 2,
    add_details: 5,
    final_check: 0,
  };
  return Math.min(MAX_IMPORTS_PER_STEP, map[a] ?? 5);
}

export function computeImportCountForStep(
  action: string,
  assetSource: "my_assets" | "library" | "both",
  foundPathsCount: number
): number {
  if (assetSource === "my_assets") return 0;
  if (action === "final_check") return 0;
  const base = getImportCountForAction(action);
  if (assetSource === "library") return base;
  if (foundPathsCount >= 5) return 0;
  const gap = Math.max(0, 5 - foundPathsCount);
  return Math.min(MAX_IMPORTS_PER_STEP, gap);
}

export async function importSequentialLibraryAssets(
  action: string,
  userPrompt: string,
  projectId: string,
  userId: string,
  stepNumber: number,
  count: number,
  sceneImportTotal: { value: number },
  onProgress?: (ev: ImportProgressEvent) => void | Promise<void>
): Promise<{ paths: string[]; imported: number }> {
  return runSequentialLibraryImports({
    action,
    userPrompt,
    projectId,
    userId,
    stepNumber,
    count,
    onProgress,
    sceneImportTotal,
  });
}

export function findAssetsForAction(action: string, scannedAssets: ScannedAsset[]): { found: string[]; missing: string[] } {
  const lowerAction = action.toLowerCase();
  const rows = scannedAssets
    .map((a) => ({ path: (a.path || "").trim(), name: (a.name || "").trim(), type: (a.type || "Unknown").trim() }))
    .filter((a) => a.path.startsWith("/Game/"));

  const matchers: Record<string, string[]> = {
    load_landscape: ["landscape", "terrain", "island", "mountain", "desert", "map"],
    place_buildings: ["building", "house", "tower", "roof", "wall", "city", "village", "town"],
    place_trees: ["tree", "plant", "foliage", "bush", "forest", "grass"],
    place_walls: ["wall", "fence", "gate", "boundary", "compound", "pillar"],
    place_vehicles: ["vehicle", "car", "truck", "bike", "bus", "boat", "plane", "helicopter"],
    add_lighting: ["light", "lamp", "torch", "lantern"],
    add_details: ["prop", "rock", "bench", "table", "barrel", "decoration", "detail"],
    final_check: [],
  };

  const keywords = matchers[lowerAction] ?? [];
  let found = rows
    .filter((r) => keywords.some((k) => r.path.toLowerCase().includes(k) || r.name.toLowerCase().includes(k)))
    .map((r) => r.path);
  if (keywords.length === 0) found = rows.slice(0, 20).map((r) => r.path);

  const minNeeded: Record<string, number> = {
    load_landscape: 1,
    place_buildings: 5,
    place_trees: 5,
    place_walls: 3,
    place_vehicles: 2,
    add_lighting: 1,
    add_details: 3,
    final_check: 0,
  };

  const needed = minNeeded[lowerAction] ?? 3;
  const missing = found.length >= needed ? [] : [lowerAction.replace("place_", "").replace("load_", "")];
  return { found: found.slice(0, 30), missing };
}

export async function importMissingAssets(
  missingTypes: string[],
  projectId: string,
  _userId: string,
  _sceneImportTotal: { value: number }
): Promise<{ newAssetPaths: string[]; imported: Array<{ asset: string; source: "polyhaven" | "sketchfab" | "none" }> }> {
  console.log("AGENT: importMissingAssets (relay removed)", { missingTypes, projectId });
  const imported: Array<{ asset: string; source: "polyhaven" | "sketchfab" | "none" }> = [];
  for (const m of missingTypes) {
    const query = `import ${m} from our 3d library`;
    const result = await handleAssetRequest(query, projectId);
    imported.push({ asset: result?.assetName ?? m, source: "none" });
  }
  return { newAssetPaths: [], imported };
}
