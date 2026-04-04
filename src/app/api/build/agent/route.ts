import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { createServerAuthClient, createServerClient } from "@/lib/supabase/server";
import { checkUsageLimit, recordUsage } from "@/lib/usage/usageTracker";
import { askAIForSceneJSON } from "@/lib/ai/sceneAI";
import { buildScene, type BuildSceneParams } from "@/lib/ai/sceneBuildEngine";
import type { AssetSourceMode, SceneRequest } from "@/lib/ai/sceneSchema";
import {
  deleteOldCompletedSessions,
  getAgentProgressBySession,
  handleStaleSession,
  insertAgentProgress,
  isStaleProgress,
  parseSearchSnapshot,
  type AgentProgressRow,
} from "@/lib/ai/agentProgress";

type ScannedAsset = { path?: string; name?: string; type?: string };

async function fetchLatestScan(userId: string, projectId?: string): Promise<{ assets: ScannedAsset[]; scannedAt: string | null }> {
  const supabase = createServerClient();
  if (projectId) {
    const { data } = await supabase
      .from("scanned_assets")
      .select("assets, scanned_at")
      .eq("user_id", userId)
      .eq("project_id", projectId)
      .order("scanned_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      return {
        assets: (data.assets as ScannedAsset[]) ?? [],
        scannedAt: (data.scanned_at as string | null) ?? null,
      };
    }
  }
  const { data: latest } = await supabase
    .from("scanned_assets")
    .select("assets, scanned_at")
    .eq("user_id", userId)
    .order("scanned_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    assets: (latest?.assets as ScannedAsset[]) ?? [],
    scannedAt: (latest?.scanned_at as string | null) ?? null,
  };
}

function emit(controller: ReadableStreamDefaultController<Uint8Array>, event: object) {
  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
}

function summarizePlanForUser(scene: SceneRequest): string {
  const parts: string[] = [];
  const sum = (label: string, arr: { type: string; count: number }[]) => {
    if (!arr.length) return;
    const n = arr.reduce((a, o) => a + o.count, 0);
    parts.push(`${n} ${label}`);
  };
  sum("buildings", scene.buildings);
  sum("trees/plants", scene.vegetation);
  sum("vehicles", scene.vehicles);
  sum("infrastructure", scene.infrastructure);
  sum("details", scene.details);
  sum("characters", scene.characters);
  return `${scene.scene_type} — ${parts.join(", ") || "objects"}`;
}

function rowToBuildParams(
  row: AgentProgressRow,
  projectId: string,
  userId: string,
  scannedAssets: ScannedAsset[],
  chunkStartTime: number,
  progressCallback: BuildSceneParams["progressCallback"],
): BuildSceneParams {
  const snap = parseSearchSnapshot(row.search_results);
  const phase = row.phase;
  const resumePhase: BuildSceneParams["resumePhase"] =
    phase === "completed" ? null : (phase as BuildSceneParams["resumePhase"]);
  return {
    sceneRequest: row.scene_request,
    projectId,
    userId,
    assetSource: row.asset_source,
    scannedAssets,
    progressCallback,
    chunkStartTime,
    sessionId: row.session_id,
    progressRowId: row.id,
    cumulativeElapsedMsBase: row.cumulative_elapsed_ms,
    resumePhase,
    resumeSearchSnapshot: snap,
    resumeImportQueue: row.import_queue ?? [],
    resumeImportedAssets: row.imported_assets ?? [],
    resumeImportedCount: row.imported_count,
    resumeTotalImports: row.total_imports,
    resumePlacementDone: row.placement_done,
    resumeScreenshotDone: row.screenshot_done,
  };
}

export async function POST(request: NextRequest) {
  const auth = await createServerAuthClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await request.json();
  const continueSessionId = typeof body?.continueSession === "string" ? body.continueSession.trim() : "";
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  const rawSource = body?.assetSource;
  const assetSource: AssetSourceMode =
    rawSource === "my_assets" || rawSource === "library" || rawSource === "both" ? rawSource : "both";

  if (!projectId) {
    return new Response(JSON.stringify({ error: "projectId required" }), { status: 400 });
  }
  if (!continueSessionId && !prompt) {
    return new Response(JSON.stringify({ error: "prompt required for new session" }), { status: 400 });
  }

  const isContinue = Boolean(continueSessionId);

  if (!isContinue) {
    const limit = await checkUsageLimit(user.id, "ai_message");
    if (!limit.allowed) {
      return new Response(JSON.stringify({ error: "AI daily limit reached", limitReached: true }), { status: 403 });
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    start: async (controller) => {
      try {
        await deleteOldCompletedSessions();

        emit(controller, {
          type: "step_start",
          stepNumber: 0,
          description: "Preparing scene build…",
        });

        let latest = await fetchLatestScan(user.id, projectId);
        const stale =
          !latest.scannedAt || Date.now() - new Date(latest.scannedAt).getTime() > 60 * 60 * 1000;
        if (stale) {
          emit(controller, {
            type: "step_start",
            stepNumber: 0,
            description:
              "Project scan is stale. Cloud relay scan is disabled — refresh with the Commander plugin, or continuing with cached / library-only data.",
          });
          latest = await fetchLatestScan(user.id, projectId);
          emit(controller, { type: "step_complete", stepNumber: 0, success: true });
        }

        const scannedForAI = assetSource === "library" ? [] : latest.assets;
        const chunkStartTime = Date.now();

        let buildParams: BuildSceneParams;

        if (isContinue) {
          let row = await getAgentProgressBySession(continueSessionId, user.id);
          if (!row) {
            emit(controller, { type: "error", message: "Session not found" });
            controller.close();
            return;
          }
          if (row.project_id !== projectId) {
            emit(controller, { type: "error", message: "Session does not match project" });
            controller.close();
            return;
          }
          if (row.status === "completed" || row.phase === "completed") {
            emit(controller, { type: "error", message: "Session already completed" });
            controller.close();
            return;
          }
          if (isStaleProgress(row)) {
            row = await handleStaleSession(row);
          }

          const sceneRequest = row.scene_request;
          emit(controller, {
            type: "plan",
            sceneRequest,
            planSummary: summarizePlanForUser(sceneRequest),
          });

          const scannedForRow = row.asset_source === "library" ? [] : latest.assets;
          buildParams = rowToBuildParams(row, projectId, user.id, scannedForRow, chunkStartTime, async (ev) => {
            emit(controller, ev as object);
          });
        } else {
          const sceneRequest = await askAIForSceneJSON(prompt, scannedForAI);
          const sessionId = randomUUID();
          const inserted = await insertAgentProgress({
            userId: user.id,
            projectId,
            sessionId,
            sceneRequest,
            assetSource,
          });

          emit(controller, {
            type: "plan",
            sceneRequest,
            planSummary: summarizePlanForUser(sceneRequest),
          });

          buildParams = {
            sceneRequest,
            projectId,
            userId: user.id,
            assetSource,
            scannedAssets: scannedForAI,
            chunkStartTime,
            sessionId,
            progressRowId: inserted.id,
            cumulativeElapsedMsBase: 0,
            resumePhase: null,
            resumeSearchSnapshot: null,
            resumeImportQueue: [],
            resumeImportedAssets: [],
            resumeImportedCount: 0,
            resumeTotalImports: 0,
            resumePlacementDone: false,
            resumeScreenshotDone: false,
            progressCallback: async (ev) => {
              emit(controller, ev as object);
            },
          };
        }

        const result = await buildScene(buildParams);

        if (result.outcome === "completed") {
          await recordUsage(user.id, "ai_message");
        }

        controller.close();
      } catch (e) {
        emit(controller, {
          type: "error",
          message: e instanceof Error ? e.message : String(e),
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
