import { NextRequest, NextResponse } from "next/server";
import { askGrandStudioAIStream } from "@/lib/ai/grandStudioAI";

export async function POST(request: NextRequest) {
  console.log("[BUILD STREAM] Request received");
  try {
    const body = await request.json();
    const { prompt, projectContext } = body;
    console.log("[BUILD STREAM] Body keys:", Object.keys(body), "prompt length:", typeof prompt === "string" ? prompt.length : 0);

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Missing prompt" },
        { status: 400 }
      );
    }

    const stream = await askGrandStudioAIStream(prompt.trim(), projectContext);

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
