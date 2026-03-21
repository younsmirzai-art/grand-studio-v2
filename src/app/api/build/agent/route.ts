import { NextRequest } from "next/server";
import { createServerAuthClient, createServerClient } from "@/lib/supabase/server";
import { checkUsageLimit, recordUsage } from "@/lib/usage/usageTracker";
import { queueUE5Command } from "@/lib/ue5/commands";
import { generateScanCode } from "@/lib/ue5/assetScanner";
import { runAgentLoop, type AgentEvent, type AgentAssetSource } from "@/lib/ai/agentLoop";

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

function emit(controller: ReadableStreamDefaultController<Uint8Array>, event: AgentEvent) {
  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
}

export async function POST(request: NextRequest) {
  const auth = await createServerAuthClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const body = await request.json();
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  const rawSource = body?.assetSource;
  const assetSource: AgentAssetSource =
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
        emit(controller, { type: "step_start", stepNumber: 0, description: "Planning your scene..." });

        // Auto scan if stale (>1h) or missing.
        let latest = await fetchLatestScan(user.id, projectId);
        const stale = !latest.scannedAt || Date.now() - new Date(latest.scannedAt).getTime() > 60 * 60 * 1000;
        if (stale) {
          emit(controller, { type: "step_start", stepNumber: 0, description: "Scanning your UE5 project..." });
          await queueUE5Command(projectId, generateScanCode(), { commandType: "scan_assets" });
          for (let i = 0; i < 12; i++) {
            await new Promise((r) => setTimeout(r, 5000));
            latest = await fetchLatestScan(user.id, projectId);
            if (latest.assets.length > 0 && latest.scannedAt && Date.now() - new Date(latest.scannedAt).getTime() < 20 * 60 * 1000) {
              break;
            }
          }
          emit(controller, { type: "step_complete", stepNumber: 0, success: true });
        }

        emit(controller, {
          type: "step_start",
          stepNumber: 0,
          description: `Found ${latest.assets.length} assets. Starting multi-step agent...`,
        });

        await runAgentLoop({
          prompt,
          projectId,
          userId: user.id,
          scannedAssets: latest.assets,
          assetSource,
          onEvent: async (event) => emit(controller, event),
        });

        await recordUsage(user.id, "ai_message");
        controller.close();
      } catch (e) {
        emit(controller, { type: "error", message: e instanceof Error ? e.message : String(e) });
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
