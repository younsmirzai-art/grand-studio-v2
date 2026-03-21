import { createServerClient } from "@/lib/supabase/server";
import { queueUE5Command } from "@/lib/ue5/commands";
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

/**
 * How many library imports for this step given asset source and scanned matches.
 * - my_assets: never import
 * - library: always up to getImportCountForAction (max 5)
 * - both: import enough to reach 5 assets in category when scan has fewer than 5
 */
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

/**
 * Poly Haven / Sketchfab: search via internal API → download → generateUE5ImportCode → UE5 queue.
 */
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
  let found = rows.filter((r) => keywords.some((k) => r.path.toLowerCase().includes(k) || r.name.toLowerCase().includes(k))).map((r) => r.path);
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

async function waitForCommand(commandId: string, timeoutMs = 120000): Promise<{ status: string; result?: unknown; error_log?: string }> {
  const supabase = createServerClient();
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { data } = await supabase
      .from("ue5_commands")
      .select("status, result, error_log")
      .eq("id", commandId)
      .maybeSingle();
    if (data?.status === "success" || data?.status === "error") {
      return { status: data.status, result: data.result, error_log: data.error_log ?? undefined };
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return { status: "timeout" };
}

export async function importMissingAssets(
  missingTypes: string[],
  projectId: string,
  userId: string,
  sceneImportTotal: { value: number }
): Promise<{ newAssetPaths: string[]; imported: Array<{ asset: string; source: "polyhaven" | "sketchfab" | "none" }> }> {
  console.log("AGENT: importMissingAssets BEFORE", { missingTypes, projectId });
  const imported: Array<{ asset: string; source: "polyhaven" | "sketchfab" | "none" }> = [];
  const newAssetPaths: string[] = [];
  const supabase = createServerClient();

  for (let mi = 0; mi < missingTypes.length; mi++) {
    const m = missingTypes[mi];
    const query = `import ${m} from our 3d library`;
    const result = await handleAssetRequest(query, projectId);
    if (!result) {
      imported.push({ asset: m, source: "none" });
      continue;
    }
    const commandId = await queueUE5Command(projectId, result.importCode, { commandType: "import" });
    const done = await waitForCommand(commandId, 180000);
    const source = result.platformUsed === "sketchfab" ? "sketchfab" : "polyhaven";
    imported.push({ asset: result.assetName || m, source });
    if (done.status === "success") {
      sceneImportTotal.value += 1;
      const { data: importRow } = await supabase
        .from("ue5_import_assets")
        .select("ue_asset_path")
        .eq("ue5_command_id", commandId)
        .maybeSingle();
      if (importRow?.ue_asset_path && typeof importRow.ue_asset_path === "string") {
        newAssetPaths.push(importRow.ue_asset_path);
      }
    }
  }

  console.log("AGENT: importMissingAssets AFTER", { count: imported.length, paths: newAssetPaths.length });
  return { newAssetPaths, imported };
}
