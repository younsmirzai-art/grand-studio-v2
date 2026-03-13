import { NextRequest, NextResponse } from "next/server";
import { askGrandStudioAIStream, isGreetingOrQuestion } from "@/lib/ai/grandStudioAI";
import { handleAssetRequest, detectAssetImportRequest } from "@/lib/asset/assetRequestHandler";
import { queueUE5Command } from "@/lib/ue5/commands";

export async function POST(request: NextRequest) {
  console.log("[BUILD STREAM] Request received");
  try {
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

    if (detectAssetImportRequest(trimmed) && projectId) {
      const result = await handleAssetRequest(trimmed, projectId);
      if (result) {
        await queueUE5Command(projectId, result.importCode);
        const stream = new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: result.chatMessage } }] })}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, fullContent: result.chatMessage })}\n\n`));
            controller.close();
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
    }

    const finalPrompt = isGreetingOrQuestion(trimmed)
      ? `The user is greeting you or asking a question. Respond with friendly text only. Do NOT write any Python code.\n\nUser: ${trimmed}`
      : trimmed;

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
