import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/server";
import { checkUsageLimit, recordUsage } from "@/lib/usage/usageTracker";
import { createTextTo3D, createImageTo3D } from "@/lib/meshy/client";

const LIMIT_MSG =
  "You have used all your AI 3D Generator credits for today. Free plan: 3/day, Pro: 3/day, Team: 10/day. Upgrade for more!";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerAuthClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // TODO: Re-enable Team plan check after testing (optional - limits apply to all plans now)
    const limitResult = await checkUsageLimit(user.id, "meshy_generate");
    if (!limitResult.allowed) {
      return NextResponse.json(
        { error: LIMIT_MSG, limitReached: true },
        { status: 403 }
      );
    }
    const body = await request.json();
    const { prompt, artStyle, type, imageUrl } = body as {
      prompt?: string;
      artStyle?: string;
      type?: "text" | "image";
      imageUrl?: string;
    };
    if (type === "image") {
      if (!imageUrl?.trim()) {
        return NextResponse.json({ error: "imageUrl required for image-to-3d" }, { status: 400 });
      }
      const taskId = await createImageTo3D(imageUrl);
      await recordUsage(user.id, "meshy_generate");
      return NextResponse.json({ taskId });
    }
    if (!prompt?.trim()) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }
    const taskId = await createTextTo3D(
      prompt.trim(),
      artStyle as "realistic" | "cartoon" | "low_poly" | "sculpture" | "pbr" | undefined
    );
    await recordUsage(user.id, "meshy_generate");
    return NextResponse.json({ taskId });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
