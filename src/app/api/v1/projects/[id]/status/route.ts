import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { ProjectTask } from "@/lib/agents/projectMode";
import { validateApiKey, unauthorizedResponse } from "@/lib/api/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(request);
  if (!auth.valid) return unauthorizedResponse();

  try {
    const { id: projectId } = await params;
    const supabase = createServerClient();
    const { data: run, error } = await supabase
      .from("full_project_run")
      .select("id, status, current_task_index, plan_json, summary")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    if (!run) {
      return NextResponse.json({
        status: "idle",
        currentTask: 0,
        totalTasks: 0,
        taskTitle: null,
        summary: null,
      });
    }

    const plan = (run.plan_json ?? []) as ProjectTask[];
    const currentIndex = (run.current_task_index as number) ?? 0;
    const currentTask = plan[currentIndex];

    return NextResponse.json({
      status: run.status,
      currentTask: currentIndex + 1,
      totalTasks: plan.length,
      taskTitle: currentTask?.title ?? null,
      summary: run.summary ?? null,
    });
  } catch (e) {
    console.error("[v1/projects/status]", e);
    return NextResponse.json(
      { error: String(e) },
      { status: 500 }
    );
  }
}
