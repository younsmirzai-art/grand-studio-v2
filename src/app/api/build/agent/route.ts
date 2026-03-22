import { NextRequest } from "next/server";
import { createServerAuthClient, createServerClient } from "@/lib/supabase/server";
import { checkUsageLimit, recordUsage } from "@/lib/usage/usageTracker";
import { queueUE5Command } from "@/lib/ue5/commands";
import { generateScanCode } from "@/lib/ue5/assetScanner";
import { askAIForSceneJSON } from "@/lib/ai/sceneAI";
import { buildScene, type AssetSourceMode } from "@/lib/ai/sceneBuildEngine";
import type { SceneRequest } from "@/lib/ai/sceneSchema";

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

export async function POST(request: NextRequest) {
  const auth = await createServerAuthClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const body = await request.json();
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  const rawSource = body?.assetSource;
  const assetSource: AssetSourceMode =
    rawSource === "my_assets" || rawSource === "library" || rawSource === "both" ? rawSource : "both";
  if (!prompt || !projectId) {
    return new Response(JSON.stringify({ error: "prompt and projectId required" }), { status: 400 });
  }

  const limit = await checkUsageLimit(user.id, "ai_message");
  if (!limit.allowed) {
    return new Response(JSON.stringify({ error: "AI daily limit reached", limitReached: true }), { status: 403 });
  }

  const stream = new ReadableStream<Uint8Array>({
    start: async (controller) => {
      try {
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
            description: "Scanning your UE5 project…",
          });
          await queueUE5Command(projectId, generateScanCode(), { commandType: "scan_assets" });
          for (let i = 0; i < 12; i++) {
            await new Promise((r) => setTimeout(r, 5000));
            latest = await fetchLatestScan(user.id, projectId);
            if (
              latest.assets.length > 0
              && latest.scannedAt
              && Date.now() - new Date(latest.scannedAt).getTime() < 20 * 60 * 1000
            ) {
              break;
            }
          }
          emit(controller, { type: "step_complete", stepNumber: 0, success: true });
        }

        const scannedForAI = assetSource === "library" ? [] : latest.assets;
        const sceneRequest = await askAIForSceneJSON(prompt, scannedForAI);

        emit(controller, {
          type: "plan",
          sceneRequest,
          planSummary: summarizePlanForUser(sceneRequest),
        });

        await buildScene(sceneRequest, projectId, user.id, assetSource, latest.assets, async (ev) => {
          emit(controller, ev as object);
        });

        await recordUsage(user.id, "ai_message");
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
