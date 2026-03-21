import { askGrandStudioAI } from "@/lib/ai/grandStudioAI";
import { queueUE5Command } from "@/lib/ue5/commands";
import { createServerClient } from "@/lib/supabase/server";
import {
  findAssetsForAction,
  importSequentialLibraryAssets,
  computeImportCountForStep,
  detectEnvironment,
  type ScannedAsset,
} from "@/lib/ai/assetResolver2";

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

function safeParsePlan(text: string): AgentStep[] | null {
  const trimmed = text.trim();
  const raw = trimmed.startsWith("[")
    ? trimmed
    : (() => {
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

/** Full scene from libraries only: each category gets import steps (3–5 models each). */
function defaultLibraryImportPlan(prompt: string): AgentStep[] {
  const env = detectEnvironment(prompt);
  const urban = env === "urban";
  return [
    {
      stepNumber: 1,
      action: "load_landscape",
      description: urban
        ? "Urban flat ground — import ground/road meshes from Poly Haven / Sketchfab"
        : "Terrain / ground cover from libraries",
      estimatedAssetCount: 2,
    },
    {
      stepNumber: 2,
      action: "place_buildings",
      description: "Import 3–5 building models (skyscrapers or houses per environment)",
      estimatedAssetCount: 5,
    },
    {
      stepNumber: 3,
      action: "place_trees",
      description: "Import 3–5 tree / vegetation models",
      estimatedAssetCount: 5,
    },
    {
      stepNumber: 4,
      action: "place_walls",
      description: "Import 3–5 fence / wall segments",
      estimatedAssetCount: 5,
    },
    {
      stepNumber: 5,
      action: "add_details",
      description: "Import props: benches, rocks, street items (3–5)",
      estimatedAssetCount: 5,
    },
    {
      stepNumber: 6,
      action: "add_lighting",
      description: "Import lamps / light fixtures if needed",
      estimatedAssetCount: 2,
    },
    {
      stepNumber: 7,
      action: "place_vehicles",
      description: urban ? "Import vehicles / traffic props" : "Optional carts / rural props",
      estimatedAssetCount: 3,
    },
    { stepNumber: 8, action: "final_check", description: "Camera, polish", estimatedAssetCount: 1 },
  ];
}

function defaultPlan(prompt: string): AgentStep[] {
  const env = detectEnvironment(prompt);
  const urban = env === "urban";
  return [
    {
      stepNumber: 1,
      action: "load_landscape",
      description: urban
        ? "Flat ground / urban base — do NOT use mountain terrain for cities"
        : "Landscape / terrain base matched to environment",
      estimatedAssetCount: 2,
    },
    { stepNumber: 2, action: "place_buildings", description: "Many buildings (10+ varied meshes)", estimatedAssetCount: 12 },
    { stepNumber: 3, action: "place_trees", description: "Dense vegetation (15+ trees/plants)", estimatedAssetCount: 18 },
    { stepNumber: 4, action: "place_walls", description: "Walls, fences, boundaries (5–10 segments)", estimatedAssetCount: 8 },
    {
      stepNumber: 5,
      action: "place_vehicles",
      description: urban ? "Cars and street traffic props" : "Carts / rural vehicles if any",
      estimatedAssetCount: 6,
    },
    { stepNumber: 6, action: "add_details", description: "Benches, rocks, street items, props (10+)", estimatedAssetCount: 12 },
    { stepNumber: 7, action: "add_lighting", description: "Lighting and atmosphere", estimatedAssetCount: 3 },
    { stepNumber: 8, action: "final_check", description: "Camera, polish, final pass", estimatedAssetCount: 1 },
  ];
}

function summarizeAssets(assets: ScannedAsset[]): string {
  const paths = assets
    .map((a) => (a.path || "").trim())
    .filter((p) => p.startsWith("/Game/"))
    .slice(0, 500);
  if (paths.length === 0) return "No scanned assets found — plan to import EVERYTHING from Poly Haven / Sketchfab.";
  return paths.map((p) => `- ${p}`).join("\n");
}

async function waitForCommand(
  commandId: string,
  timeoutMs = 150000
): Promise<{ status: string; error?: string; screenshotUrl?: string | null }> {
  const supabase = createServerClient();
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data } = await supabase
      .from("ue5_commands")
      .select("status, error_log, screenshot_url")
      .eq("id", commandId)
      .maybeSingle();
    if (data?.status === "success") return { status: "success", screenshotUrl: data.screenshot_url ?? null };
    if (data?.status === "error") return { status: "error", error: data.error_log ?? "Unknown UE5 error" };
    await new Promise((r) => setTimeout(r, 3000));
  }
  return { status: "timeout", error: "Command timed out" };
}

const SCREENSHOT_CODE = `
import unreal
import datetime
import os
os.makedirs(r'C:\\\\building_games\\\\screenshots', exist_ok=True)
timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
filepath = os.path.join(r'C:\\\\building_games\\\\screenshots', f'agent_{timestamp}.png')
try:
    unreal.AutomationUtilsBlueprintLibrary.take_high_res_screenshot(1920, 1080, filepath)
    unreal.log(f'SCREENSHOT_SAVED:{filepath}')
except Exception as e:
    unreal.log_error(str(e))
`.trim();

export async function runAgentLoop(args: RunAgentLoopArgs): Promise<{ summary: string; steps: AgentStep[] }> {
  const { prompt, projectId, scannedAssets, assetSource, onEvent, userId } = args;

  const sourceNote =
    assetSource === "my_assets"
      ? "ASSET SOURCE: USER PROJECT ONLY — do NOT rely on library imports in the plan; use scanned paths."
      : assetSource === "library"
        ? "ASSET SOURCE: LIBRARIES ONLY — ignore scanned assets; plan explicit import steps for buildings, trees, walls, ground, props, lighting (3–5 models per category from Poly Haven + Sketchfab)."
        : "ASSET SOURCE: BOTH — use scanned assets where they exist; plan library imports to fill any category with fewer than 5 matching assets.";

  const planningPrompt = `You are a scene planner. Given the user request and scanned asset paths, output ONLY a JSON array of steps.
Each step: stepNumber, action (load_landscape, place_buildings, place_trees, place_walls, place_vehicles, add_lighting, add_details, final_check), description, estimatedAssetCount.

${sourceNote}

CRITICAL — ASSET DENSITY (when libraries allowed):
- NEVER build a sparse scene. A complete village-style scene needs 40–60+ placed objects minimum.
- Each step must place MANY assets where applicable: buildings at least 10; trees at least 15; details at least 10; walls/fences 5–10 segments where relevant.
- Library mode: include import coverage for EVERY category (buildings, trees, walls, ground, props, lighting objects) with 3–5 models each from Poly Haven / Sketchfab.

CRITICAL — MATCH ENVIRONMENT TO USER REQUEST (terrain + asset types MUST align):
- City / urban / "like New York": flat ground or city base; skyscrapers, modern buildings, roads, cars, street lights from the library. DO NOT use mountain or wilderness landscape for cities.
- Village / rural: green landscape with hills; small houses, farms, fences, animals, carts.
- Forest / forest village: mountain or forest terrain; many different trees, rocks, paths — not urban blocks.
- Beach / coastal: island or sand terrain; boats, palm trees, beach props, docks.
- Desert: desert terrain; desert buildings, cacti, rocks, sand structures.

Minimum 3 steps, maximum 10. Prefer 6–8 steps. Always include lighting/atmosphere and final_check.

USER REQUEST:
${prompt}

SCANNED ASSETS (may be empty):
${summarizeAssets(scannedAssets)}
`;

  let steps: AgentStep[] = [];
  try {
    const planResp = await askGrandStudioAI(planningPrompt);
    steps = safeParsePlan(planResp.rawResponse) ?? (assetSource === "library" ? defaultLibraryImportPlan(prompt) : defaultPlan(prompt));
  } catch {
    steps = assetSource === "library" ? defaultLibraryImportPlan(prompt) : defaultPlan(prompt);
  }
  // FIX4: minimal test — "build 3 trees" + library only runs a single tree-import step.
  if (assetSource === "library" && /^\s*build\s+3\s+trees?\s*\.?\s*$/i.test(prompt.trim())) {
    steps = [
      {
        stepNumber: 1,
        action: "place_trees",
        description: "Search Poly Haven for tree, import 3 different models, then place in scene",
        estimatedAssetCount: 3,
      },
      { stepNumber: 2, action: "final_check", description: "Verify placement", estimatedAssetCount: 1 },
    ];
  }
  await onEvent({ type: "plan", steps });

  const usedAssets = new Set<string>();
  let completed = 0;
  let totalLibraryImportsSucceeded = 0;
  const sceneImportTotal = { value: 0 };

  for (const step of steps) {
    await onEvent({ type: "step_start", stepNumber: step.stepNumber, description: step.description });

    const scannedForStep = assetSource === "library" ? [] : scannedAssets;
    const { found } = findAssetsForAction(step.action, scannedForStep);
    let availablePaths = assetSource === "library" ? [] : [...found];

    let importCount = computeImportCountForStep(step.action, assetSource, found.length);
    const treeMatch = prompt.match(/(\d+)\s+trees?/i);
    if (treeMatch && step.action === "place_trees") {
      importCount = Math.min(importCount, parseInt(treeMatch[1], 10));
    }

    if (importCount > 0 && step.action !== "final_check") {
      console.log(
        `AGENT: Starting library import for step ${step.stepNumber}, need ${importCount} assets of type ${step.action} (assetSource=${assetSource})`
      );
      const seq = await importSequentialLibraryAssets(
        step.action,
        prompt,
        projectId,
        userId,
        step.stepNumber,
        importCount,
        sceneImportTotal,
        async (ev) => {
          await onEvent({
            type: "importing",
            asset: ev.asset,
            source: ev.source,
            current: ev.current,
            total: ev.total,
          });
        }
      );
      console.log(
        `AGENT: Finished importSequentialLibraryAssets for step ${step.stepNumber}, imported ${seq.imported}, paths ${seq.paths.length}`
      );
      totalLibraryImportsSucceeded += seq.imported;
      availablePaths = [...new Set([...availablePaths, ...seq.paths])];
    }

    const assetsForStep = [...new Set(availablePaths)].slice(0, 80);
    assetsForStep.forEach((p) => usedAssets.add(p));

    let success = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const execPrompt = `Focus ONLY on this step. Place MANY instances (grid/scatter) — NOT just one or two actors.
Step action: ${step.action}
Step description: ${step.description}
Attempt: ${attempt + 1}/3
User request: ${prompt}
Environment hint: ${detectEnvironment(prompt)}
Asset source mode: ${assetSource}
Use exact /Game/... paths — spawn with unreal.EditorAssetLibrary.load_asset and unreal.EditorLevelLibrary.spawn_actor_from_object.
Paths to use (scan + imports):
${assetsForStep.length ? assetsForStep.map((p) => `- ${p}`).join("\n") : "- Import paths may appear after relay; if empty, use Starter Content only as last resort"}

Generate complete UE5 Python for THIS STEP ONLY.`;
      const generated = await askGrandStudioAI(execPrompt, `Agent step ${step.stepNumber} for project ${projectId}`);
      const code = generated.code || generated.rawResponse;
      await onEvent({ type: "step_code", stepNumber: step.stepNumber, code });

      const cmdId = await queueUE5Command(projectId, code);
      const result = await waitForCommand(cmdId);
      if (result.status === "success") {
        success = true;
        const ssCmd = await queueUE5Command(projectId, SCREENSHOT_CODE);
        const ssRes = await waitForCommand(ssCmd, 60000);
        await onEvent({ type: "step_screenshot", stepNumber: step.stepNumber, screenshotUrl: ssRes.screenshotUrl ?? null });
        break;
      }
      await onEvent({
        type: "error",
        stepNumber: step.stepNumber,
        message: `Failed attempt ${attempt + 1}: ${result.error || "Unknown error"}`,
      });
    }

    await onEvent({ type: "step_complete", stepNumber: step.stepNumber, success });
    if (success) completed += 1;
  }

  const summary = `Scene agent finished ${completed}/${steps.length} steps. Library imports succeeded: ${totalLibraryImportsSucceeded}. Unique asset paths used: ${usedAssets.size}. Asset source: ${assetSource}.`;
  await onEvent({ type: "complete", summary });
  return { summary, steps };
}
