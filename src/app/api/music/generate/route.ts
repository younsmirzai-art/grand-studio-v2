import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient, createServerClient } from "@/lib/supabase/server";
import { checkUsageLimit, recordUsage, getEffectivePlan } from "@/lib/usage/usageTracker";
import { generateMusic } from "@/lib/music/client";

const LIMIT_MSG = "You have used all your AI Music tracks for today. Free: 3, Pro: 10, Team: 30. Upgrade for more!";

export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = await createServerAuthClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const plan = await getEffectivePlan(user.id);
    const limitResult = await checkUsageLimit(user.id, "music_generate");
    if (!limitResult.allowed) {
      return NextResponse.json(
        { error: LIMIT_MSG, limitReached: true },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { prompt, style, duration } = body as {
      prompt?: string;
      style?: string;
      duration?: string;
    };

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const durationMap: Record<string, number> = {
      "30": 30,
      "60": 60,
      "120": 120,
    };
    const durationSeconds = durationMap[duration ?? "60"] ?? 60;

    const taskId = await generateMusic(
      prompt.trim(),
      style ?? "cinematic",
      durationSeconds
    );

    await recordUsage(user.id, "music_generate");

    const supabase = createServerClient();
    await supabase.from("generated_music").insert({
      user_id: user.id,
      task_id: taskId,
      prompt: prompt.trim(),
      style: style ?? null,
      duration: duration ?? "1 minute",
      status: "pending",
    });

    return NextResponse.json({ taskId });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[music/generate] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
