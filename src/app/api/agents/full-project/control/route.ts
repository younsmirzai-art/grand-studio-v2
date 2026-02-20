import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { projectId, action } = await request.json();

    if (!projectId || !action) {
      return NextResponse.json(
        { error: "Missing projectId or action" },
        { status: 400 }
      );
    }

    if (!["pause", "resume", "stop"].includes(action)) {
      return NextResponse.json(
        { error: "Action must be pause, resume, or stop" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const status = action === "resume" ? "executing" : action === "pause" ? "paused" : "stopped";

    const { data: run } = await supabase
      .from("full_project_run")
      .select("id")
      .eq("project_id", projectId)
      .in("status", ["planning", "executing", "paused"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!run?.id) {
      return NextResponse.json(
        { error: "No active run found for this project" },
        { status: 404 }
      );
    }

    const { error } = await supabase
      .from("full_project_run")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", run.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[full-project/control] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
