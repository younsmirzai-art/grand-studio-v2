import { NextRequest, NextResponse } from "next/server";
import { askGrandStudioAIStream } from "@/lib/ai/grandStudioAI";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, projectContext } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Missing prompt" },
        { status: 400 }
      );
    }

    const stream = await askGrandStudioAIStream(prompt.trim(), projectContext);

    if (!stream) {
      return NextResponse.json(
        { error: "Failed to start stream" },
        { status: 500 }
      );
    }

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/build/stream] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
