import { NextRequest, NextResponse } from "next/server";
import { getTaskStatus, getImageTo3DStatus, getRetextureStatus, getTextToImageStatus } from "@/lib/meshy/client";

export async function GET(request: NextRequest) {
  try {
    const taskId = request.nextUrl.searchParams.get("taskId");
    const mode = request.nextUrl.searchParams.get("mode") ?? "text-to-3d";
    if (!taskId) {
      return NextResponse.json({ error: "taskId required" }, { status: 400 });
    }

    if (mode === "texture") {
      const result = await getRetextureStatus(taskId);
      const modelUrl = result.status === "SUCCEEDED" && result.model_urls?.glb
        ? result.model_urls.glb
        : undefined;
      return NextResponse.json({
        status: result.status,
        progress: result.progress,
        modelUrl,
      });
    }

    if (mode === "text-to-image") {
      const result = await getTextToImageStatus(taskId);
      const imageUrl = result.status === "SUCCEEDED" && result.image_urls?.[0]
        ? result.image_urls[0]
        : undefined;
      return NextResponse.json({
        status: result.status,
        progress: result.progress,
        modelUrl: undefined,
        imageUrl,
      });
    }

    if (mode === "image") {
      const result = await getImageTo3DStatus(taskId);
      const modelUrl = result.status === "SUCCEEDED" && result.model_urls?.glb
        ? result.model_urls.glb
        : undefined;
      return NextResponse.json({
        status: result.status,
        progress: result.progress,
        modelUrl,
      });
    }

    const result = await getTaskStatus(taskId);
    const modelUrl = result.status === "SUCCEEDED" && result.model_urls?.glb
      ? result.model_urls.glb
      : undefined;
    return NextResponse.json({
      status: result.status,
      progress: result.progress,
      modelUrl,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
