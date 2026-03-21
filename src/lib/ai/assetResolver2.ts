import { createServerClient } from "@/lib/supabase/server";
import { queueUE5Command } from "@/lib/ue5/commands";
import { handleAssetRequest } from "@/lib/asset/assetRequestHandler";

export type ScannedAsset = { path?: string; name?: string; type?: string };

export type ImportProgressEvent = {
  asset: string;
  source: "polyhaven" | "sketchfab" | "none";
  current: number;
  total: number;
};

/** Rough environment from user prompt — drives which library assets to search for. */
export function detectEnvironment(prompt: string): "urban" | "village" | "forest" | "beach" | "desert" | "generic" {
  const p = prompt.toLowerCase();
  if (/new york|urban|city|downtown|skyscraper|manhattan|metropolitan|street|highway|nyc|los angeles|chicago/i.test(p))
    return "urban";
  if (/beach|coast|island|tropical|palm|ocean|shore|seaside/i.test(p)) return "beach";
  if (/desert|sand dune|arid|cactus|oasis/i.test(p)) return "desert";
  if (/forest village|woodland|village in forest/i.test(p)) return "forest";
  if (/forest|woods|mountain|hiking trail|pine/i.test(p)) return "forest";
  if (/village|rural|farm|farmhouse|countryside|medieval town|hamlet/i.test(p)) return "village";
  return "generic";
}

function pickQueriesForAction(
  action: string,
  userPrompt: string,
  slotIndex: number
): { poly: string; sketchfab: string } {
  const env = detectEnvironment(userPrompt);
  const i = slotIndex % 20;
  const urbanBuildings = ["skyscraper", "office building", "apartment building", "city building", "modern building", "tower block", "brick building", "glass facade building", "residential block", "commercial building"];
  const villageBuildings = ["cottage", "farm house", "small house", "wooden house", "medieval house", "rustic building", "barn", "stone house", "country house", "village hut"];
  const trees = ["oak tree", "pine tree", "birch tree", "willow tree", "maple tree", "dead tree", "bush", "shrub", "fern", "grass clump"];
  const walls = ["fence wooden", "stone wall", "brick wall", "gate", "picket fence", "barrier", "railing", "hedge"];
  const vehicles = ["car sedan", "van", "truck", "bus", "bicycle", "motorcycle"];
  const detailsUrban = ["street lamp", "bench park", "trash can", "traffic light", "mailbox", "hydrant", "news stand", "planter box"];
  const detailsRural = ["wooden bench", "rock formation", "barrel", "crate", "wagon", "well", "hay bale", "fence post"];
  const beach = ["palm tree", "beach chair", "boat small", "dock piece", "surfboard", "shell", "umbrella beach", "lifeguard tower", "driftwood", "coral rock"];
  const desert = ["cactus", "desert rock", "sand dune rock", "desert hut", "camel statue", "dead tree desert", "ruin stone", "tent", "campfire ring", "dry bush"];

  const a = action.toLowerCase();
  if (a === "place_buildings") {
    if (env === "urban") return { poly: urbanBuildings[i % urbanBuildings.length], sketchfab: "building modern" };
    if (env === "village" || env === "generic") return { poly: villageBuildings[i % villageBuildings.length], sketchfab: "house medieval" };
    if (env === "beach") return { poly: beach[i % beach.length], sketchfab: "beach house" };
    if (env === "desert") return { poly: desert[i % desert.length], sketchfab: "desert building" };
    return { poly: villageBuildings[i % villageBuildings.length], sketchfab: "cabin" };
  }
  if (a === "place_trees") {
    if (env === "beach") return { poly: beach.filter((x) => x.includes("palm"))[0] ?? "palm tree", sketchfab: "palm tree" };
    return { poly: trees[i % trees.length], sketchfab: "tree stylized" };
  }
  if (a === "place_walls") return { poly: walls[i % walls.length], sketchfab: "fence" };
  if (a === "place_vehicles") {
    if (env === "urban") return { poly: vehicles[i % vehicles.length], sketchfab: "car city" };
    return { poly: "cart wooden", sketchfab: "tractor" };
  }
  if (a === "add_details")
    return env === "urban"
      ? { poly: detailsUrban[i % detailsUrban.length], sketchfab: "street props" }
      : { poly: detailsRural[i % detailsRural.length], sketchfab: "nature props" };
  if (a === "load_landscape") {
    if (env === "urban") return { poly: "city ground", sketchfab: "asphalt" };
    if (env === "beach") return { poly: "sand terrain", sketchfab: "beach sand" };
    if (env === "desert") return { poly: "desert ground", sketchfab: "sand" };
    if (env === "forest") return { poly: "forest ground", sketchfab: "terrain grass" };
    return { poly: "grass terrain", sketchfab: "ground plane" };
  }
  return { poly: "rock", sketchfab: "prop" };
}

/** Target library imports per step — aggressive fill (minimum ~25+ across a full run). */
export function getImportCountForAction(action: string): number {
  const a = action.toLowerCase();
  const map: Record<string, number> = {
    load_landscape: 2,
    place_buildings: 10,
    place_trees: 15,
    place_walls: 5,
    place_vehicles: 5,
    add_lighting: 2,
    add_details: 10,
    final_check: 0,
  };
  return map[a] ?? 5;
}

const WAIT_MS_BETWEEN_IMPORTS = 4000;

/**
 * Import many assets ONE BY ONE: search → download → queue UE → wait for command → wait 3–5s before next.
 */
export async function importSequentialLibraryAssets(
  action: string,
  userPrompt: string,
  projectId: string,
  count: number,
  onProgress?: (ev: ImportProgressEvent) => void | Promise<void>
): Promise<{ paths: string[]; imported: number }> {
  const paths: string[] = [];
  const supabase = createServerClient();
  let imported = 0;

  for (let i = 0; i < count; i++) {
    const { poly, sketchfab } = pickQueriesForAction(action, userPrompt, i);
    let result = await handleAssetRequest(`import ${poly} from polyhaven`, projectId);
    let usedName = poly;
    let source: "polyhaven" | "sketchfab" | "none" = "none";
    if (!result) {
      result = await handleAssetRequest(`import ${sketchfab} from sketchfab`, projectId);
      usedName = sketchfab;
    }
    if (!result) {
      result = await handleAssetRequest(`import ${poly} from our 3d library`, projectId);
      usedName = poly;
    }
    if (!result) {
      await onProgress?.({
        asset: usedName,
        source: "none",
        current: i + 1,
        total: count,
      });
      await new Promise((r) => setTimeout(r, WAIT_MS_BETWEEN_IMPORTS));
      continue;
    }
    source = result.platformUsed === "sketchfab" ? "sketchfab" : "polyhaven";
    await onProgress?.({
      asset: result.assetName || usedName,
      source,
      current: i + 1,
      total: count,
    });

    const commandId = await queueUE5Command(projectId, result.importCode, { commandType: "import" });
    const done = await waitForCommand(commandId, 180000);
    if (done.status === "success") {
      imported += 1;
      const { data: importRow } = await supabase
        .from("ue5_import_assets")
        .select("ue_asset_path")
        .eq("ue5_command_id", commandId)
        .maybeSingle();
      if (importRow?.ue_asset_path && typeof importRow.ue_asset_path === "string") {
        paths.push(importRow.ue_asset_path);
      }
    }
    await new Promise((r) => setTimeout(r, WAIT_MS_BETWEEN_IMPORTS));
  }

  return { paths, imported };
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
  projectId: string
): Promise<{ newAssetPaths: string[]; imported: Array<{ asset: string; source: "polyhaven" | "sketchfab" | "none" }> }> {
  const imported: Array<{ asset: string; source: "polyhaven" | "sketchfab" | "none" }> = [];
  const newAssetPaths: string[] = [];
  const supabase = createServerClient();

  for (const m of missingTypes) {
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

  return { newAssetPaths, imported };
}
