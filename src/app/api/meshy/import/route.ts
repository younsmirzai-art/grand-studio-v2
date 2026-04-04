import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/server";
import { getTaskStatus, getImageTo3DStatus, getRetextureStatus } from "@/lib/meshy/client";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerAuthClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const { taskId, mode } = body as { taskId?: string; projectId?: string; mode?: string };
    if (!taskId) {
      return NextResponse.json({ error: "taskId required" }, { status: 400 });
    }

    const resolvedMode = mode === "image" ? "image" : mode === "texture" ? "texture" : "text";
    const result =
      resolvedMode === "image"
        ? await getImageTo3DStatus(taskId)
        : resolvedMode === "texture"
          ? await getRetextureStatus(taskId)
          : await getTaskStatus(taskId);

    console.log("[meshy/import] mode:", resolvedMode, "full result:", JSON.stringify(result));

    const glbUrl = result.model_urls?.glb ?? (result as { model_url?: string }).model_url;
    if (result.status !== "SUCCEEDED" || !glbUrl) {
      return NextResponse.json(
        { error: "Model not ready or generation failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      modelUrl: glbUrl,
      message:
        "Download the GLB and drag it into the UE5 Content Browser (Import). The website no longer queues imports through a relay.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
