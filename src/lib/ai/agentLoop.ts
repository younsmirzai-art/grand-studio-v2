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
const WAIT_EVERY_3_COMMANDS_MS = 15000;
const RELAY_RETRY_MS = 15000;
const RELAY_MAX_RETRIES = 10;

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
  if (text.includes("house") || text.includes("building")) return "building";
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

function buildPlacementCode(paths: string[], step: AgentStep): string {
  if (paths.length === 0) return "# waiting for imports";
  const lines: string[] = ["import unreal", "editor = unreal.EditorLevelLibrary"];
  for (let i = 0; i < paths.length; i++) {
    const p = paths[i].replace(/'/g, "\\'");
    lines.push(`asset_${i} = unreal.EditorAssetLibrary.load_asset('${p}')`);
    lines.push(`if asset_${i}:`);
    lines.push(`    actor_${i} = editor.spawn_actor_from_object(asset_${i}, unreal.Vector(${i * 300}, 0, 0))`);
    lines.push(`    if actor_${i}: actor_${i}.set_actor_label('Agent_${step.action}_${i + 1}')`);
  }
  return lines.join("\n");
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

  const planningPrompt = `You are a scene planner. Output ONLY a JSON array of steps with: stepNumber, action, description, estimatedAssetCount.\n\nMatch plan complexity to request:\n- Simple request like build 1 house = 2-3 steps max.\n- Medium request like small garden = 4-5 steps.\n- Complex request like village = 6-8 steps.\n- Very complex like city = 8-10 steps.\n\nUser request:\n${prompt}\n\nScanned assets:\n${summarizeAssets(scannedAssets)}`;

  let steps: AgentStep[] = [];
  try {
    const planResp = await askGrandStudioAI(planningPrompt);
    steps = safeParsePlan(planResp.rawResponse) ?? defaultPlan(prompt);
  } catch {
    steps = defaultPlan(prompt);
  }

  if (isSimpleRequest(prompt)) steps = defaultSimplePlan(prompt);
  if (assetSource === "library" && /^\s*build\s+1\s+tree\s*\.?\s*$/i.test(prompt.trim())) {
    steps = [
      { stepNumber: 1, action: "place_trees", description: "Import tree model", estimatedAssetCount: 1 },
      { stepNumber: 2, action: "place_trees", description: "Place imported tree model", estimatedAssetCount: 1 },
    ];
  }

  await onEvent({ type: "plan", steps });

  let completed = 0;
  let totalLibraryImportsSucceeded = 0;
  let commandsQueued = 0;
  const usedAssets = new Set<string>();

  for (const step of steps) {
    await onEvent({ type: "step_start", stepNumber: step.stepNumber, description: step.description });

    const scannedForStep = assetSource === "library" ? [] : scannedAssets;
    const { found } = findAssetsForAction(step.action, scannedForStep);
    const availablePaths = [...found];

    if ((assetSource === "library" || assetSource === "both") && isPlacementStep(step.action)) {
      console.log(`AGENT LOOP: About to call library import for step ${step.stepNumber}, assetSource=${assetSource}`);
      const searchQuery = searchQueryForStep(step);
      const toImport = importsPerStep(prompt);

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
            const cmdId = await queueUE5Command(projectId, importCode, { commandType: "import" });
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
              const cmdId = await queueUE5Command(projectId, importCode, { commandType: "import" });
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
        }
      }
    }

    const stepAssets = [...new Set(availablePaths)].slice(0, 6);
    const code = buildPlacementCode(stepAssets, step);
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
