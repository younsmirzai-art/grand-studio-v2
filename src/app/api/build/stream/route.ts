import { NextRequest, NextResponse } from "next/server";
import { askGrandStudioAIStream, isGreetingOrQuestion } from "@/lib/ai/grandStudioAI";
import { handleAssetRequest, detectAssetImportRequest } from "@/lib/asset/assetRequestHandler";
import { queueUE5Command } from "@/lib/ue5/commands";
import { checkUsageLimit, recordUsage } from "@/lib/usage/usageTracker";
import { createServerAuthClient } from "@/lib/supabase/server";

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
          return streamJsonError("You've reached your daily Poly Haven import limit. Upgrade to Pro for unlimited imports!");
        }
      }
      if (checkSketch) {
        const sketchCheck = await checkUsageLimit(userId, "sketchfab_import");
        if (!sketchCheck.allowed) {
          return streamJsonError("You've reached your daily Sketchfab import limit. Upgrade to Pro for unlimited imports!");
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
            const msg = "Couldn't find that on Poly Haven or Sketchfab. Try the Poly Haven or Sketchfab tab to browse, or use a different search term.";
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

    await recordUsage(userId, "ai_message");

    const stream = await askGrandStudioAIStream(finalPrompt, projectContext);

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
