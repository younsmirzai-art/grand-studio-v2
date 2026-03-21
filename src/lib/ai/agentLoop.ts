import { askGrandStudioAI } from "@/lib/ai/grandStudioAI";
import { queueUE5Command } from "@/lib/ue5/commands";
import { createServerClient } from "@/lib/supabase/server";
import { findAssetsForAction, importMissingAssets, type ScannedAsset } from "@/lib/ai/assetResolver2";

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

export type AgentEvent =
  | { type: "plan"; steps: AgentStep[] }
  | { type: "step_start"; stepNumber: number; description: string }
  | { type: "step_code"; stepNumber: number; code: string }
  | { type: "step_complete"; stepNumber: number; success: boolean }
  | { type: "step_screenshot"; stepNumber: number; screenshotUrl: string | null }
  | { type: "importing"; asset: string; source: "polyhaven" | "sketchfab" | "none" }
  | { type: "error"; stepNumber?: number; message: string }
  | { type: "complete"; summary: string };

type RunAgentLoopArgs = {
  prompt: string;
  projectId: string;
  userId: string;
  scannedAssets: ScannedAsset[];
  onEvent: (event: AgentEvent) => Promise<void> | void;
};

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

function defaultPlan(prompt: string): AgentStep[] {
  const isOutdoor = /village|town|city|forest|outdoor|landscape|park/i.test(prompt);
  return [
    { stepNumber: 1, action: "load_landscape", description: "Load landscape base map", estimatedAssetCount: 1 },
    { stepNumber: 2, action: "place_buildings", description: "Place multiple building meshes", estimatedAssetCount: 6 },
    { stepNumber: 3, action: "place_trees", description: "Place varied trees and plants", estimatedAssetCount: 8 },
    { stepNumber: 4, action: "place_walls", description: "Add walls / boundaries / fences", estimatedAssetCount: 4 },
    { stepNumber: 5, action: isOutdoor ? "add_lighting" : "add_details", description: "Set lighting and atmosphere", estimatedAssetCount: 3 },
    { stepNumber: 6, action: "final_check", description: "Final camera and polish pass", estimatedAssetCount: 1 },
  ];
}

function summarizeAssets(assets: ScannedAsset[]): string {
  const paths = assets
    .map((a) => (a.path || "").trim())
    .filter((p) => p.startsWith("/Game/"))
    .slice(0, 400);
  if (paths.length === 0) return "No scanned assets found.";
  return paths.map((p) => `- ${p}`).join("\n");
}

async function waitForCommand(commandId: string, timeoutMs = 150000): Promise<{ status: string; error?: string; screenshotUrl?: string | null }> {
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
  const { prompt, projectId, scannedAssets, onEvent } = args;

  const planningPrompt = `You are a scene planner. Given this user request and their available assets, create a step-by-step plan.
Return ONLY a JSON array of steps.
Each step has: stepNumber, action (load_landscape, place_buildings, place_trees, place_walls, place_vehicles, add_lighting, add_details, final_check), description, estimatedAssetCount.
Rules:
- Minimum 3 steps, maximum 10.
- Use multiple assets per step (3-10 where possible).
- If missing assets, plan to import from library.
- Always end with lighting/camera final pass.

USER REQUEST:
${prompt}

SCANNED ASSETS:
${summarizeAssets(scannedAssets)}
`;

  let steps: AgentStep[] = [];
  try {
    const planResp = await askGrandStudioAI(planningPrompt);
    steps = safeParsePlan(planResp.rawResponse) ?? defaultPlan(prompt);
  } catch {
    steps = defaultPlan(prompt);
  }
  await onEvent({ type: "plan", steps });

  const usedAssets = new Set<string>();
  let completed = 0;

  for (const step of steps) {
    await onEvent({ type: "step_start", stepNumber: step.stepNumber, description: step.description });
    const { found, missing } = findAssetsForAction(step.action, scannedAssets);
    let availablePaths = [...found];

    if (missing.length > 0) {
      const imported = await importMissingAssets(missing, projectId);
      for (const imp of imported.imported) {
        await onEvent({ type: "importing", asset: imp.asset, source: imp.source });
      }
      availablePaths = [...availablePaths, ...imported.newAssetPaths];
    }

    const assetsForStep = [...new Set(availablePaths)].slice(0, 25);
    assetsForStep.forEach((p) => usedAssets.add(p));

    let success = false;
    let lastErr = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const execPrompt = `Focus ONLY on this step.
Step action: ${step.action}
Step description: ${step.description}
Attempt: ${attempt + 1}/3
User request: ${prompt}
Use exact asset paths when possible:
${assetsForStep.length ? assetsForStep.map((p) => `- ${p}`).join("\n") : "- none provided"}

Generate complete UE5 Python code for this step only.
`;
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
      lastErr = result.error || "Unknown error";
      await onEvent({ type: "error", stepNumber: step.stepNumber, message: `Failed attempt ${attempt + 1}: ${lastErr}` });
    }

    await onEvent({ type: "step_complete", stepNumber: step.stepNumber, success });
    if (success) completed += 1;
  }

  const summary = `Scene agent finished ${completed}/${steps.length} steps using ${usedAssets.size} assets.`;
  await onEvent({ type: "complete", summary });
  return { summary, steps };
}
