import { askGrandStudioAI } from "@/lib/ai/grandStudioAI";
import { queueUE5Command } from "@/lib/ue5/commands";
import { createServerClient } from "@/lib/supabase/server";
import { findAssetsForAction, detectEnvironment, type ScannedAsset } from "@/lib/ai/assetResolver2";
import { isRelayOnline } from "@/lib/ue5/relayStatus";
import { generateUE5ImportCode, generateSketchfabImportCode } from "@/lib/ue5/importCode";
import { searchAssets as searchPolyHaven } from "@/lib/polyhaven/client";
import { downloadPolyHavenModelToStorage as downloadPolyHavenModel } from "@/lib/polyhaven/downloadToSupabase";
import { searchModels as searchSketchfab, getDownloadUrl as getSketchfabDownloadUrl } from "@/lib/sketchfab/client";

export type AgentStepAction =
  | "load_landscape"
  | "place_buildings"
  | "place_trees"
  | "place_walls"
  | "place_vehicles"
  | "add_lighting"
  | "add_details"
  | "final_check";

export type AgentStep = {
  stepNumber: number;
  action: AgentStepAction;
  description: string;
  estimatedAssetCount: number;
};

export type AgentAssetSource = "my_assets" | "library" | "both";

export type AgentEvent =
  | { type: "plan"; steps: AgentStep[] }
  | { type: "step_start"; stepNumber: number; description: string }
  | { type: "step_code"; stepNumber: number; code: string }
  | { type: "step_complete"; stepNumber: number; success: boolean }
  | { type: "step_screenshot"; stepNumber: number; screenshotUrl: string | null }
  | {
      type: "importing";
      asset: string;
      source: "polyhaven" | "sketchfab" | "none";
      current?: number;
      total?: number;
    }
  | { type: "error"; stepNumber?: number; message: string }
  | { type: "complete"; summary: string };

type RunAgentLoopArgs = {
  prompt: string;
  projectId: string;
  userId: string;
  scannedAssets: ScannedAsset[];
  assetSource: AgentAssetSource;
  onEvent: (event: AgentEvent) => Promise<void> | void;
};

const WAIT_AFTER_COMMAND_MS = 10000;
const WAIT_AFTER_BUILDING_IMPORT_MS = 20000;
/** Minimum time between queued Poly Haven / Sketchfab import commands so UE5 can finish one import. */
const WAIT_BETWEEN_IMPORT_COMMANDS_MS = 15000;
const WAIT_EVERY_3_COMMANDS_MS = 15000;
const RELAY_RETRY_MS = 15000;
const RELAY_MAX_RETRIES = 10;

/** Scanned / Fab paths that must never appear in generated UE code when assetSource is "library". */
const FORBIDDEN_LIBRARY_UE_PATH_PREFIXES = [
  "/Game/Fab/",
  "/Game/Survival_Character/",
  "/Game/ProceduralBuildingGenerator/",
  "/Game/Sankoolarts/",
  "/Game/MWLandscapeAutoMaterial/",
] as const;

function codeViolatesLibraryMode(code: string): boolean {
  return FORBIDDEN_LIBRARY_UE_PATH_PREFIXES.some((prefix) => code.includes(prefix));
}

function filterPathsForLibraryMode(paths: string[]): string[] {
  return paths.filter(
    (p) => !FORBIDDEN_LIBRARY_UE_PATH_PREFIXES.some((prefix) => p.includes(prefix)),
  );
}

function safeParsePlan(text: string): AgentStep[] | null {
  const trimmed = text.trim();
  const raw = trimmed.startsWith("[") ? trimmed : (() => {
    const m = trimmed.match(/\[[\s\S]*\]/);
    return m ? m[0] : "";
  })();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AgentStep[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed.map((s, i) => ({
      stepNumber: Number(s.stepNumber ?? i + 1),
      action: (s.action as AgentStepAction) || "add_details",
      description: String(s.description ?? `Step ${i + 1}`),
      estimatedAssetCount: Number(s.estimatedAssetCount ?? 3),
    }));
  } catch {
    return null;
  }
}

function isSimpleRequest(prompt: string): boolean {
  const p = prompt.trim().toLowerCase();
  return /^build\s+1\s+house\.?$/.test(p)
    || /^build\s+1\s+tree\.?$/.test(p)
    || /^add\s+3\s+trees?\.?$/.test(p)
    || /^place\s+a\s+car\.?$/.test(p)
    || /^build\s+\d+\s+house(s)?\.?$/.test(p)
    || /^add\s+\d+\s+trees?\.?$/.test(p);
}

function defaultSimplePlan(prompt: string): AgentStep[] {
  const p = prompt.toLowerCase();
  if (p.includes("tree")) {
    return [
      { stepNumber: 1, action: "place_trees", description: "Import requested tree model(s)", estimatedAssetCount: 1 },
      { stepNumber: 2, action: "place_trees", description: "Place imported tree model(s)", estimatedAssetCount: 1 },
    ];
  }
  if (p.includes("car") || p.includes("vehicle")) {
    return [
      { stepNumber: 1, action: "place_vehicles", description: "Import requested vehicle model", estimatedAssetCount: 1 },
      { stepNumber: 2, action: "place_vehicles", description: "Place imported vehicle model", estimatedAssetCount: 1 },
    ];
  }
  return [
    { stepNumber: 1, action: "place_buildings", description: "Import requested house/building model", estimatedAssetCount: 1 },
    { stepNumber: 2, action: "place_buildings", description: "Place imported house/building model", estimatedAssetCount: 1 },
    { stepNumber: 3, action: "add_lighting", description: "Optional quick lighting", estimatedAssetCount: 1 },
  ];
}

/** Library mode: import-first steps; final step places all imports with lighting. */
function defaultLibrarySimplePlan(prompt: string): AgentStep[] {
  const p = prompt.toLowerCase();
  const treeOnly = (p.includes("tree") || /^build\s+1\s+tree/.test(p.trim())) && !p.includes("house");
  if (treeOnly) {
    return [
      { stepNumber: 1, action: "place_trees", description: "Import tree model from library", estimatedAssetCount: 1 },
      { stepNumber: 2, action: "add_lighting", description: "Place imported tree in scene with lighting", estimatedAssetCount: 1 },
    ];
  }
  if (p.includes("car") || p.includes("vehicle")) {
    return [
      { stepNumber: 1, action: "place_vehicles", description: "Import vehicle model from library", estimatedAssetCount: 1 },
      { stepNumber: 2, action: "add_lighting", description: "Place imported vehicle with lighting", estimatedAssetCount: 1 },
    ];
  }
  return [
    { stepNumber: 1, action: "place_buildings", description: "Import house model from library", estimatedAssetCount: 1 },
    { stepNumber: 2, action: "place_trees", description: "Import 3 tree models from library", estimatedAssetCount: 3 },
    { stepNumber: 3, action: "add_lighting", description: "Place all imported models in scene with lighting", estimatedAssetCount: 1 },
  ];
}

function defaultPlan(prompt: string): AgentStep[] {
  const env = detectEnvironment(prompt);
  const urban = env === "urban";
  return [
    { stepNumber: 1, action: "load_landscape", description: urban ? "Setup urban base" : "Setup terrain base", estimatedAssetCount: 2 },
    { stepNumber: 2, action: "place_buildings", description: "Import/place buildings", estimatedAssetCount: 6 },
    { stepNumber: 3, action: "place_trees", description: "Import/place trees", estimatedAssetCount: 6 },
    { stepNumber: 4, action: "place_walls", description: "Import/place walls and fences", estimatedAssetCount: 4 },
    { stepNumber: 5, action: "add_details", description: "Import/place details and furniture", estimatedAssetCount: 4 },
    { stepNumber: 6, action: "add_lighting", description: "Lighting pass", estimatedAssetCount: 2 },
    { stepNumber: 7, action: "final_check", description: "Final check", estimatedAssetCount: 1 },
  ];
}

/**
 * Library-only: imports first (house, trees, …), then one placement + lighting step.
 * Never starts with load_landscape / sky — Poly Haven & Sketchfab imports come first.
 */
function defaultLibraryPlan(prompt: string): AgentStep[] {
  const p = prompt.toLowerCase();
  const steps: AgentStep[] = [];
  let n = 1;
  const wantsHouse =
    p.includes("house") || p.includes("building") || p.includes("castle") || /\bbuild\b/.test(p);
  const treeMatch = p.match(/(\d+)\s*trees?/);
  const treeCount = treeMatch ? Math.min(5, Math.max(1, parseInt(treeMatch[1], 10))) : 3;

  if (wantsHouse) {
    steps.push({
      stepNumber: n++,
      action: "place_buildings",
      description: "Import house model from library",
      estimatedAssetCount: 1,
    });
  }
  if (p.includes("tree") || p.includes("garden") || p.includes("forest") || p.includes("yard")) {
    steps.push({
      stepNumber: n++,
      action: "place_trees",
      description: "Import tree models from library",
      estimatedAssetCount: treeCount,
    });
  } else if (wantsHouse) {
    steps.push({
      stepNumber: n++,
      action: "place_trees",
      description: "Import 3 tree models from library",
      estimatedAssetCount: 3,
    });
  }
  if (steps.length === 0) {
    return [
      { stepNumber: 1, action: "place_buildings", description: "Import model from library", estimatedAssetCount: 1 },
      { stepNumber: 2, action: "add_lighting", description: "Place imported models in scene with lighting", estimatedAssetCount: 1 },
    ];
  }
  steps.push({
    stepNumber: n++,
    action: "add_lighting",
    description: "Place all imported models in scene with lighting",
    estimatedAssetCount: 1,
  });
  return steps.map((s, i) => ({ ...s, stepNumber: i + 1 }));
}

/** Remove planner steps that would pull sky/terrain before imports in library mode. */
function normalizeLibraryPlanSteps(steps: AgentStep[]): AgentStep[] {
  const filtered = steps
    .filter((s) => s.action !== "load_landscape")
    .map((s, i) => ({ ...s, stepNumber: i + 1 }));
  return filtered;
}

function summarizeAssets(assets: ScannedAsset[]): string {
  const paths = assets.map((a) => (a.path || "").trim()).filter((p) => p.startsWith("/Game/")).slice(0, 200);
  if (paths.length === 0) return "No scanned assets.";
  return paths.map((p) => `- ${p}`).join("\n");
}

function isPlacementStep(action: AgentStepAction): boolean {
  return action !== "final_check";
}

function searchQueryForStep(step: AgentStep): string {
  const text = `${step.action} ${step.description}`.toLowerCase();
  if (text.includes("house") || text.includes("building") || text.includes("castle")) return "building";
  if (text.includes("tree") || text.includes("forest")) return "tree";
  if (text.includes("wall") || text.includes("fence")) return "wall";
  if (text.includes("detail") || text.includes("furniture") || text.includes("bench")) return "furniture";
  if (text.includes("vehicle") || text.includes("car")) return "car";
  if (text.includes("light") || text.includes("lamp")) return "lamp";
  return "prop";
}

function importsPerStep(prompt: string): number {
  if (isSimpleRequest(prompt)) return 1;
  return 2;
}

function expectedImportedAssetPath(name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9_]/g, "_");
  return `/Game/GrandStudio/Imported/${safe}`;
}

function buildLibraryModeCodePreamble(importedPaths: string[]): string {
  const list =
    importedPaths.length > 0
      ? importedPaths.map((p) => `- ${p}`).join("\n# ")
      : "- (none yet — complete previous import steps first)";
  return `# LIBRARY MODE EXECUTION:
# You have NO local assets available. You must ONLY use assets imported by the agent in previous steps.
# Imported assets to use with EditorAssetLibrary.load_asset (ONLY these paths):
# ${list}
# Do NOT use any /Game/Fab/, /Game/ProceduralBuildingGenerator/, /Game/Sankoolarts/, /Game/MWLandscapeAutoMaterial/, /Game/Survival_Character/, or other scanned marketplace paths.
`;
}

function buildPlacementCode(
  paths: string[],
  step: AgentStep,
  opts?: { libraryMode?: boolean; importedPathsForPrompt?: string[] },
): string {
  const libraryMode = opts?.libraryMode === true;
  const importedPathsForPrompt = opts?.importedPathsForPrompt ?? paths;
  const preamble = libraryMode ? buildLibraryModeCodePreamble(importedPathsForPrompt) : "";
  if (paths.length === 0) {
    return preamble + (libraryMode ? "# waiting for imports\n" : "# waiting for imports");
  }
  const lines: string[] = [preamble.trimEnd(), "import unreal", "editor = unreal.EditorLevelLibrary"].filter(Boolean);
  for (let i = 0; i < paths.length; i++) {
    const p = paths[i].replace(/'/g, "\\'");
    lines.push(`asset_${i} = unreal.EditorAssetLibrary.load_asset('${p}')`);
    lines.push(`if asset_${i}:`);
    lines.push(`    actor_${i} = editor.spawn_actor_from_object(asset_${i}, unreal.Vector(${i * 300}, 0, 0))`);
    lines.push(`    if actor_${i}: actor_${i}.set_actor_label('Agent_${step.action}_${i + 1}')`);
  }
  return lines.join("\n");
}

/** How many Poly Haven / Sketchfab imports to run for this step in library mode. */
function libraryImportCountForStep(step: AgentStep, userPrompt: string): number {
  const p = userPrompt.toLowerCase();
  if (step.action === "add_lighting" || step.action === "final_check") return 0;
  if (step.action === "place_trees") {
    const m = p.match(/(\d+)\s*trees?/);
    if (m) return Math.min(5, Math.max(1, parseInt(m[1], 10)));
    return Math.min(5, Math.max(1, step.estimatedAssetCount || 3));
  }
  if (step.action === "place_buildings") return 1;
  if (
    step.action === "place_walls"
    || step.action === "place_vehicles"
    || step.action === "add_details"
    || step.action === "load_landscape"
  ) {
    return Math.min(5, Math.max(1, step.estimatedAssetCount || 2));
  }
  return Math.min(5, Math.max(1, step.estimatedAssetCount || 1));
}

function shouldRunLibraryPolySketchfabImports(
  assetSource: AgentAssetSource,
  step: AgentStep,
): boolean {
  if (!(assetSource === "library" || assetSource === "both")) return false;
  if (!isPlacementStep(step.action)) return false;
  if (step.action === "final_check") return false;
  if (assetSource === "library" && step.action === "add_lighting") return false;
  return true;
}

async function waitForRelayOrTimeout(): Promise<boolean> {
  for (let i = 0; i < RELAY_MAX_RETRIES; i++) {
    if (await isRelayOnline()) return true;
    await new Promise((r) => setTimeout(r, RELAY_RETRY_MS));
  }
  return false;
}

async function waitForCommand(commandId: string, timeoutMs = 180000): Promise<{ status: string; error?: string }> {
  const supabase = createServerClient();
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { data } = await supabase.from("ue5_commands").select("status, error_log").eq("id", commandId).maybeSingle();
    if (data?.status === "success") return { status: "success" };
    if (data?.status === "error") return { status: "error", error: data.error_log ?? "Unknown error" };
    await new Promise((r) => setTimeout(r, 3000));
  }
  return { status: "timeout", error: "Command timeout" };
}

async function waitAfterQueuedCommand(commandsQueued: number, waitMs: number): Promise<void> {
  console.log(`IMPORT: Waiting ${Math.round(waitMs / 1000)} seconds for UE5`);
  await new Promise((r) => setTimeout(r, waitMs));
  if (commandsQueued % 3 === 0) {
    await new Promise((r) => setTimeout(r, WAIT_EVERY_3_COMMANDS_MS));
  }
}

export async function runAgentLoop(args: RunAgentLoopArgs): Promise<{ summary: string; steps: AgentStep[] }> {
  const { prompt, projectId, scannedAssets, assetSource, onEvent } = args;

  const effectiveScannedAssets: ScannedAsset[] = assetSource === "library" ? [] : scannedAssets;
  if (assetSource === "library") {
    console.log(
      "AGENT: Asset source mode = library. Scanned assets DISABLED. Using ONLY Poly Haven and Sketchfab imports.",
    );
  }

  const planningPrompt =
    assetSource === "library"
      ? `You are a scene planner. Output ONLY a JSON array of steps with: stepNumber, action, description, estimatedAssetCount.

CRITICAL: The user has NO local assets. You must plan to IMPORT every 3D asset from our online library (do not name external sites in the JSON). For a house, the plan must import a house model. For trees, import tree models. Do not reference any existing /Game/ paths, user scans, Fab, or marketplace folders.

Do NOT use load_landscape, sky, or atmosphere as step 1. Imports must happen FIRST; then one step to place all imported models with lighting.

Valid actions: load_landscape, place_buildings, place_trees, place_walls, place_vehicles, add_lighting, add_details, final_check.

Match plan complexity to request:
- Simple request like build 1 house = 3 steps: import house, import trees, place all with lighting.
- Medium request = 4-5 steps.
- Complex village/city = 6-8 steps.

User request:
${prompt}`
      : `You are a scene planner. Output ONLY a JSON array of steps with: stepNumber, action, description, estimatedAssetCount.\n\nMatch plan complexity to request:\n- Simple request like build 1 house = 2-3 steps max.\n- Medium request like small garden = 4-5 steps.\n- Complex request like village = 6-8 steps.\n- Very complex like city = 8-10 steps.\n\nUser request:\n${prompt}\n\nScanned assets:\n${summarizeAssets(effectiveScannedAssets)}`;

  let steps: AgentStep[] = [];
  try {
    const planResp = await askGrandStudioAI(planningPrompt);
    steps =
      safeParsePlan(planResp.rawResponse)
      ?? (assetSource === "library" ? defaultLibraryPlan(prompt) : defaultPlan(prompt));
  } catch {
    steps = assetSource === "library" ? defaultLibraryPlan(prompt) : defaultPlan(prompt);
  }

  if (isSimpleRequest(prompt)) {
    steps = assetSource === "library" ? defaultLibrarySimplePlan(prompt) : defaultSimplePlan(prompt);
  }
  if (assetSource === "library") {
    steps = normalizeLibraryPlanSteps(steps);
    if (steps.length === 0) steps = defaultLibraryPlan(prompt);
  }

  await onEvent({ type: "plan", steps });

  let completed = 0;
  let totalLibraryImportsSucceeded = 0;
  let commandsQueued = 0;
  const usedAssets = new Set<string>();
  const allImportedPathsOrdered: string[] = [];

  for (const step of steps) {
    await onEvent({ type: "step_start", stepNumber: step.stepNumber, description: step.description });

    const scannedForStep = assetSource === "library" ? [] : scannedAssets;
    const { found } = findAssetsForAction(step.action, scannedForStep);
    let availablePaths =
      assetSource === "library" ? [] : [...found];

    if (shouldRunLibraryPolySketchfabImports(assetSource, step)) {
      const toImport =
        assetSource === "library" ? libraryImportCountForStep(step, prompt) : importsPerStep(prompt);
      console.log(
        `AGENT LOOP: Library import for step ${step.stepNumber}, assetSource=${assetSource}, toImport=${toImport}`,
      );
      const searchQuery = searchQueryForStep(step);
      let lastPolySketchfabImportQueuedAt = 0;

      for (let i = 0; i < toImport; i++) {
        await onEvent({ type: "importing", asset: searchQuery, source: "none", current: i + 1, total: toImport });

        console.log(`AGENT DIRECT: Searching Poly Haven for ${searchQuery}`);
        const polyResults = await searchPolyHaven(searchQuery, "models", 20);
        console.log(`AGENT DIRECT: Found ${polyResults.length} results`);

        let importedPath: string | null = null;

        if (polyResults.length > 0) {
          const asset = polyResults[0];
          const downloadUrl = await downloadPolyHavenModel(asset.id);
          console.log(`AGENT DIRECT: Download URL = ${downloadUrl?.slice(0, 100) ?? "none"}`);
          if (downloadUrl) {
            const importCode = generateUE5ImportCode(downloadUrl, `${asset.id}.fbx`, asset.name);
            const relayReady = await waitForRelayOrTimeout();
            if (!relayReady) {
              await onEvent({ type: "error", stepNumber: step.stepNumber, message: "Relay disconnected while importing." });
              continue;
            }
            if (lastPolySketchfabImportQueuedAt > 0) {
              const elapsed = Date.now() - lastPolySketchfabImportQueuedAt;
              if (elapsed < WAIT_BETWEEN_IMPORT_COMMANDS_MS) {
                const gap = WAIT_BETWEEN_IMPORT_COMMANDS_MS - elapsed;
                console.log(
                  `AGENT: Waiting ${Math.round(gap / 1000)}s before next Poly Haven/Sketchfab import (min ${WAIT_BETWEEN_IMPORT_COMMANDS_MS / 1000}s between imports).`,
                );
                await new Promise((r) => setTimeout(r, gap));
              }
            }
            const cmdId = await queueUE5Command(projectId, importCode, { commandType: "import" });
            lastPolySketchfabImportQueuedAt = Date.now();
            commandsQueued += 1;
            console.log("AGENT DIRECT: Import code queued");
            const result = await waitForCommand(cmdId);
            await waitAfterQueuedCommand(commandsQueued, step.action === "place_buildings" ? WAIT_AFTER_BUILDING_IMPORT_MS : WAIT_AFTER_COMMAND_MS);
            if (result.status === "success") {
              totalLibraryImportsSucceeded += 1;
              const supabase = createServerClient();
              const { data: importRow } = await supabase
                .from("ue5_import_assets")
                .select("ue_asset_path")
                .eq("ue5_command_id", cmdId)
                .maybeSingle();
              importedPath = importRow?.ue_asset_path ?? expectedImportedAssetPath(asset.name);
              await onEvent({ type: "importing", asset: asset.name, source: "polyhaven", current: i + 1, total: toImport });
            }
          }
        } else {
          console.log(`AGENT DIRECT: Searching Sketchfab for ${searchQuery}`);
          const sketchResults = await searchSketchfab(searchQuery, {
            count: 12,
            token: process.env.SKETCHFAB_API_TOKEN ?? undefined,
          });
          console.log(`AGENT DIRECT: Found ${sketchResults.length} results`);
          if (sketchResults.length > 0) {
            const skAsset = sketchResults[0];
            const token = process.env.SKETCHFAB_API_TOKEN;
            const sketchfabUrl = token ? await getSketchfabDownloadUrl(skAsset.uid, token) : null;
            console.log(`AGENT DIRECT: Download URL = ${sketchfabUrl?.slice(0, 100) ?? "none"}`);
            if (sketchfabUrl) {
              const importCode = generateSketchfabImportCode(sketchfabUrl, `${skAsset.uid}.zip`, skAsset.name);
              const relayReady = await waitForRelayOrTimeout();
              if (!relayReady) {
                await onEvent({ type: "error", stepNumber: step.stepNumber, message: "Relay disconnected while importing." });
                continue;
              }
              if (lastPolySketchfabImportQueuedAt > 0) {
                const elapsed = Date.now() - lastPolySketchfabImportQueuedAt;
                if (elapsed < WAIT_BETWEEN_IMPORT_COMMANDS_MS) {
                  const gap = WAIT_BETWEEN_IMPORT_COMMANDS_MS - elapsed;
                  console.log(
                    `AGENT: Waiting ${Math.round(gap / 1000)}s before next Poly Haven/Sketchfab import (min ${WAIT_BETWEEN_IMPORT_COMMANDS_MS / 1000}s between imports).`,
                  );
                  await new Promise((r) => setTimeout(r, gap));
                }
              }
              const cmdId = await queueUE5Command(projectId, importCode, { commandType: "import" });
              lastPolySketchfabImportQueuedAt = Date.now();
              commandsQueued += 1;
              console.log("AGENT DIRECT: Import code queued");
              const result = await waitForCommand(cmdId);
              await waitAfterQueuedCommand(commandsQueued, step.action === "place_buildings" ? WAIT_AFTER_BUILDING_IMPORT_MS : WAIT_AFTER_COMMAND_MS);
              if (result.status === "success") {
                totalLibraryImportsSucceeded += 1;
                const supabase = createServerClient();
                const { data: importRow } = await supabase
                  .from("ue5_import_assets")
                  .select("ue_asset_path")
                  .eq("ue5_command_id", cmdId)
                  .maybeSingle();
                importedPath = importRow?.ue_asset_path ?? expectedImportedAssetPath(skAsset.name);
                await onEvent({ type: "importing", asset: skAsset.name, source: "sketchfab", current: i + 1, total: toImport });
              }
            }
          }
        }

        if (importedPath) {
          availablePaths.push(importedPath);
          usedAssets.add(importedPath);
          allImportedPathsOrdered.push(importedPath);
        }
      }
    }

    if (assetSource === "library") {
      availablePaths = filterPathsForLibraryMode(availablePaths);
    }

    const importedPathsForPrompt = [...new Set(allImportedPathsOrdered)];
    let stepAssets = [...new Set(availablePaths)].slice(0, 6);
    let code = buildPlacementCode(stepAssets, step, {
      libraryMode: assetSource === "library",
      importedPathsForPrompt,
    });
    if (assetSource === "library" && codeViolatesLibraryMode(code)) {
      console.warn(
        "AGENT: REJECTED step code — contained forbidden scanned/asset paths. Regenerating from imported paths only.",
      );
      stepAssets = filterPathsForLibraryMode(stepAssets);
      code = buildPlacementCode(stepAssets, step, {
        libraryMode: true,
        importedPathsForPrompt,
      });
    }
    await onEvent({ type: "step_code", stepNumber: step.stepNumber, code });

    let success = false;
    const relayReady = await waitForRelayOrTimeout();
    if (!relayReady) {
      await onEvent({ type: "error", stepNumber: step.stepNumber, message: "Relay disconnected; skipped step command." });
    } else {
      const cmdId = await queueUE5Command(projectId, code, { commandType: "import" });
      commandsQueued += 1;
      const result = await waitForCommand(cmdId);
      await waitAfterQueuedCommand(commandsQueued, WAIT_AFTER_COMMAND_MS);
      success = result.status === "success";
      if (!success) {
        await onEvent({ type: "error", stepNumber: step.stepNumber, message: `Step command failed: ${result.error || "Unknown error"}` });
      }
    }

    await onEvent({ type: "step_complete", stepNumber: step.stepNumber, success });
    if (success) completed += 1;
  }

  const summary = `Scene agent finished ${completed}/${steps.length} steps. Library imports succeeded: ${totalLibraryImportsSucceeded}. Unique asset paths used: ${usedAssets.size}. Asset source: ${assetSource}.`;
  await onEvent({ type: "complete", summary });
  return { summary, steps };
}
