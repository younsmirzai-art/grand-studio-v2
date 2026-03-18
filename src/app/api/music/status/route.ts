import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient, createServerClient } from "@/lib/supabase/server";
import { getTaskStatus } from "@/lib/music/client";

export async function GET(request: NextRequest) {
  try {
    const supabaseAuth = await createServerAuthClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const taskId = request.nextUrl.searchParams.get("taskId");
    if (!taskId) {
      return NextResponse.json({ error: "taskId required" }, { status: 400 });
    }

    const statusResult = await getTaskStatus(taskId);

    if (statusResult.status === "succeeded" && statusResult.audioUrl) {
      const supabase = createServerClient();
      await supabase
        .from("generated_music")
        .update({
          status: "completed",
          audio_url: statusResult.audioUrl,
          completed_at: new Date().toISOString(),
        })
        .eq("task_id", taskId)
        .eq("user_id", user.id);
    } else if (statusResult.status === "failed") {
      const supabase = createServerClient();
      await supabase
        .from("generated_music")
        .update({ status: "failed" })
        .eq("task_id", taskId)
        .eq("user_id", user.id);
    }

    return NextResponse.json({
      status: statusResult.status,
      progress: statusResult.progress,
      audioUrl: statusResult.audioUrl ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
