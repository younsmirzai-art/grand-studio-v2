import { NextRequest, NextResponse } from "next/server";
import { askGrandStudioAIStream, isGreetingOrQuestion } from "@/lib/ai/grandStudioAI";
import { handleAssetRequest, detectAssetImportRequest } from "@/lib/asset/assetRequestHandler";
import { queueUE5Command } from "@/lib/ue5/commands";
import { checkUsageLimit, recordUsage } from "@/lib/usage/usageTracker";
import { createServerAuthClient, createServerClient } from "@/lib/supabase/server";

const UPGRADE_MSG_AI = "You've used all 10 free AI messages today. Upgrade to Pro for unlimited messages!";
const UPGRADE_MSG_IMPORT = "You've reached your daily import limit. Upgrade to Pro for unlimited imports!";

function streamJsonError(message: string): Response {
  const encoder = new TextEncoder();
  const body = (controller: ReadableStreamDefaultController<Uint8Array>) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message, limitReached: true })}\n\n`));
    controller.close();
  };
  return new Response(new ReadableStream({ start: body }), {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}

function buildScannedAssetsSummary(assets: Array<{ name?: string; path?: string; type?: string }>): string {
  const grouped = new Map<string, Array<{ name?: string; path?: string }>>();
  for (const a of assets) {
    const t = (a.type || "Unknown").trim();
    if (!grouped.has(t)) grouped.set(t, []);
    grouped.get(t)!.push({ name: a.name, path: a.path });
  }
  const lines: string[] = [];
  for (const [type, items] of [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`${type} (${items.length})`);
    for (const item of items.slice(0, 20)) {
      lines.push(`- ${item.name || "Unnamed"} | ${item.path || ""}`);
    }
  }
  return lines.slice(0, 300).join("\n");
}

export async function POST(request: NextRequest) {
  console.log("[BUILD STREAM] Request received");
  try {
    const supabaseAuth = await createServerAuthClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const body = await request.json();
    const { prompt, projectContext, projectId } = body;
    console.log("[BUILD STREAM] Body keys:", Object.keys(body), "prompt length:", typeof prompt === "string" ? prompt.length : 0);

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Missing prompt" },
        { status: 400 }
      );
    }

    const trimmed = prompt.trim();
    const importDetected = detectAssetImportRequest(trimmed);
    console.log("[BUILD STREAM] Checking if import request:", !!importDetected, "projectId:", !!projectId);
    if (importDetected) {
      console.log("[BUILD STREAM] Import detected — platform:", importDetected.platform, "query:", importDetected.query);
    }

    if (importDetected && projectId) {
      const platform = importDetected.platform;
      const checkPoly = platform === "polyhaven" || platform === "both";
      const checkSketch = platform === "sketchfab" || platform === "both";
      if (checkPoly) {
        const polyCheck = await checkUsageLimit(userId, "polyhaven_import");
        if (!polyCheck.allowed) {
          return streamJsonError("You've reached your daily model import limit. Upgrade to Pro for unlimited imports!");
        }
      }
      if (checkSketch) {
        const sketchCheck = await checkUsageLimit(userId, "sketchfab_import");
        if (!sketchCheck.allowed) {
          return streamJsonError("You've reached your daily community import limit. Upgrade to Pro for unlimited imports!");
        }
      }

      console.log("[BUILD STREAM] Handling import directly — NOT calling AI");
      const result = await handleAssetRequest(trimmed, projectId);
      console.log("[BUILD STREAM] handleAssetRequest result:", result ? "success" : "null");

      if (result?.platformUsed) {
        await recordUsage(userId, result.platformUsed === "polyhaven" ? "polyhaven_import" : "sketchfab_import");
      }

      const encoder = new TextEncoder();
      const streamBody = result
        ? (controller: ReadableStreamDefaultController<Uint8Array>) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: result!.chatMessage } }] })}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, fullContent: result!.chatMessage })}\n\n`));
            controller.close();
          }
        : (controller: ReadableStreamDefaultController<Uint8Array>) => {
            const msg = "Couldn't find that model. Try a different search term or browse the Asset Library tabs.";
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: msg } }] })}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, fullContent: msg })}\n\n`));
            controller.close();
          };
      if (result) {
        await queueUE5Command(projectId, result.importCode);
      }
      return new Response(new ReadableStream({ start: streamBody }), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    const aiCheck = await checkUsageLimit(userId, "ai_message");
    if (!aiCheck.allowed) {
      return streamJsonError(UPGRADE_MSG_AI);
    }

    const finalPrompt = isGreetingOrQuestion(trimmed)
      ? `The user is greeting you or asking a question. Respond with friendly text only. Do NOT write any Python code.\n\nUser: ${trimmed}`
      : trimmed;

    let scannedAssetsContext = "";
    if (projectId && !isGreetingOrQuestion(trimmed)) {
      try {
        const supabase = createServerClient();
        const { data } = await supabase
          .from("scanned_assets")
          .select("assets")
          .eq("user_id", userId)
          .eq("project_id", projectId)
          .order("scanned_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const assets = (data?.assets as Array<{ name?: string; path?: string; type?: string }>) ?? [];
        if (assets.length > 0) {
          scannedAssetsContext = `Available assets in user's UE5 project:\n${buildScannedAssetsSummary(assets)}`;
        }
      } catch {
        // best effort only
      }
    }

    await recordUsage(userId, "ai_message");

    const enrichedContext = [projectContext, scannedAssetsContext].filter(Boolean).join("\n\n");
    const stream = await askGrandStudioAIStream(finalPrompt, enrichedContext || undefined);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[BUILD STREAM] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
