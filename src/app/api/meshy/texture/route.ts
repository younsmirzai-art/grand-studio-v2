import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/server";
import { checkUsageLimit, recordUsage } from "@/lib/usage/usageTracker";
import { createRetexture } from "@/lib/meshy/client";

const LIMIT_MSG =
  "You have used all your AI 3D Generator credits for today. Free plan: 3/day, Pro: 3/day, Team: 10/day. Upgrade for more!";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerAuthClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const limitResult = await checkUsageLimit(user.id, "meshy_generate");
    if (!limitResult.allowed) {
      return NextResponse.json(
        { error: LIMIT_MSG, limitReached: true },
        { status: 403 }
      );
    }
    const body = await request.json();
    const { modelUrl, prompt } = body as { modelUrl?: string; prompt?: string };
    if (!modelUrl?.trim() || !prompt?.trim()) {
      return NextResponse.json(
        { error: "modelUrl and prompt (texture description) are required" },
        { status: 400 }
      );
    }
    const taskId = await createRetexture(modelUrl.trim(), prompt.trim(), { enablePbr: true });
    await recordUsage(user.id, "meshy_generate");
    return NextResponse.json({ taskId, mode: "texture" });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
