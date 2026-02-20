import { NextRequest, NextResponse } from "next/server";
import { startFullProject } from "@/lib/agents/projectMode";
import { expandPrompt } from "@/lib/agents/smartPrompt";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const { projectId, prompt } = await request.json();

    if (!projectId || !prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Missing projectId or prompt" },
        { status: 400 }
      );
    }

    const trimmed = prompt.trim();
    const expanded = await expandPrompt(trimmed, projectId);
    const result = await startFullProject(projectId, expanded);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[full-project] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
