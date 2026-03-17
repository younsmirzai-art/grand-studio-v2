import { NextRequest, NextResponse } from "next/server";
import { getTaskStatus } from "@/lib/meshy/client";

export async function GET(request: NextRequest) {
  try {
    const taskId = request.nextUrl.searchParams.get("taskId");
    if (!taskId) {
      return NextResponse.json({ error: "taskId required" }, { status: 400 });
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
