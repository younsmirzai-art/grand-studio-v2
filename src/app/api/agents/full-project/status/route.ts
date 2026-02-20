import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { ProjectTask } from "@/lib/agents/projectMode";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data: run, error } = await supabase
      .from("full_project_run")
      .select("id, status, current_task_index, plan_json, summary")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !run) {
      return NextResponse.json({
        running: false,
        status: null,
        currentTaskIndex: 0,
        totalTasks: 0,
        currentTaskTitle: null,
        plan: [],
        summary: null,
      });
    }

    const plan = (run.plan_json ?? []) as ProjectTask[];
    const currentIndex = (run.current_task_index as number) ?? 0;
    const currentTask = plan[currentIndex];
    const totalTasks = plan.length;

    return NextResponse.json({
      running: run.status === "planning" || run.status === "executing" || run.status === "paused",
      status: run.status,
      currentTaskIndex: currentIndex,
      totalTasks,
      currentTaskTitle: currentTask?.title ?? null,
      plan,
      summary: run.summary ?? null,
    });
  } catch (e) {
    console.error("[full-project/status]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
