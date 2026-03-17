import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/server";
import { getEffectivePlan } from "@/lib/usage/usageTracker";
import { createTextTo3D, createImageTo3D } from "@/lib/meshy/client";

const TEAM_ONLY_MSG =
  "AI 3D Generator is exclusive to Team plan. Upgrade to Team for $49/month to create custom 3D models with AI.";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerAuthClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const plan = await getEffectivePlan(user.id);
    if (plan !== "team") {
      return NextResponse.json(
        { error: TEAM_ONLY_MSG, limitReached: true },
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
      return NextResponse.json({ taskId });
    }
    if (!prompt?.trim()) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }
    const taskId = await createTextTo3D(
      prompt.trim(),
      artStyle as "realistic" | "cartoon" | "low_poly" | "sculpture" | "pbr" | undefined
    );
    return NextResponse.json({ taskId });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
