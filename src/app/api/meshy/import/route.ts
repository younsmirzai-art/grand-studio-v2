import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/server";
import { getEffectivePlan } from "@/lib/usage/usageTracker";
import { getTaskStatus } from "@/lib/meshy/client";
import { generateUE5ImportCode } from "@/lib/ue5/importCode";
import { queueUE5Command } from "@/lib/ue5/commands";

const TEAM_ONLY_MSG = "AI 3D Generator is exclusive to Team plan.";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerAuthClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const plan = await getEffectivePlan(user.id);
    if (plan !== "team") {
      return NextResponse.json({ error: TEAM_ONLY_MSG, limitReached: true }, { status: 403 });
    }
    const body = await request.json();
    const { taskId, projectId } = body as { taskId?: string; projectId?: string };
    if (!taskId || !projectId) {
      return NextResponse.json({ error: "taskId and projectId required" }, { status: 400 });
    }
    const result = await getTaskStatus(taskId);
    if (result.status !== "SUCCEEDED" || !result.model_urls?.glb) {
      return NextResponse.json(
        { error: "Model not ready or generation failed" },
        { status: 400 }
      );
    }
    const glbUrl = result.model_urls.glb;
    const label = "AIGenerated";
    const filename = `meshy-${taskId.slice(0, 8)}.glb`;
    const code = generateUE5ImportCode(glbUrl, filename, label);
    const commandId = await queueUE5Command(projectId, code);
    return NextResponse.json({ success: true, commandId });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
