import { NextRequest, NextResponse } from "next/server";
import { startFullProject } from "@/lib/agents/projectMode";
import { expandPrompt } from "@/lib/agents/smartPrompt";
import { createServerClient } from "@/lib/supabase/server";
import { validateApiKey, unauthorizedResponse } from "@/lib/api/auth";

export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(request);
  if (!auth.valid) return unauthorizedResponse();

  try {
    const { id: projectId } = await params;
    const body = await request.json().catch(() => ({}));
    const { prompt: bodyPrompt } = body as { prompt?: string };

    const supabase = createServerClient();
    const { data: project } = await supabase
      .from("projects")
      .select("id, initial_prompt")
      .eq("id", projectId)
      .single();

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const prompt = (bodyPrompt && typeof bodyPrompt === "string"
      ? bodyPrompt.trim()
      : (project.initial_prompt as string) || "").trim();
    if (!prompt) {
      return NextResponse.json(
        { error: "No prompt. Provide prompt in body or set project initial_prompt." },
        { status: 400 }
      );
    }

    const expanded = await expandPrompt(prompt, projectId);
    const result = await startFullProject(projectId, expanded);

    return NextResponse.json({
      runId: result.runId,
      status: "building",
      tasksCount: result.tasksCount,
    });
  } catch (error) {
    console.error("[v1/projects/build]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
