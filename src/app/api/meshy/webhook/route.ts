import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const WEBHOOK_SECRET_HEADER = "x-meshy-webhook-secret";

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.MESHY_WEBHOOK_KEY;
    const received = request.headers.get(WEBHOOK_SECRET_HEADER) ?? request.headers.get("x-webhook-secret");
    if (!secret || received !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const event = body as {
      event?: string;
      task_id?: string;
      status?: string;
      result?: {
        model_urls?: { glb?: string; fbx?: string; obj?: string };
        thumbnail_url?: string;
      };
      prompt?: string;
      art_style?: string;
      mode?: string;
      user_id?: string;
      created_at?: string;
      completed_at?: string;
    };

    const taskId = event.task_id ?? body.task_id;
    const status = (event.status ?? body.status ?? "unknown") as string;
    const modelUrl = event.result?.model_urls?.glb ?? body.result?.model_urls?.glb ?? null;
    const thumbnailUrl = event.result?.thumbnail_url ?? body.result?.thumbnail_url ?? null;
    const prompt = event.prompt ?? body.prompt ?? null;
    const artStyle = event.art_style ?? body.art_style ?? null;
    const mode = (event.mode ?? body.mode ?? "text-to-3d") as string;
    const userId = event.user_id ?? body.user_id ?? "";

    console.log("[meshy/webhook] event:", JSON.stringify({ taskId, status, mode, userId }));

    const supabase = createServerClient();
    const row = {
      user_id: userId || "unknown",
      task_id: taskId,
      prompt,
      status,
      model_url: modelUrl,
      thumbnail_url: thumbnailUrl,
      art_style: artStyle,
      mode: mode === "image-to-3d" ? "image-to-3d" : mode === "text-to-texture" ? "texture" : "text-to-3d",
      completed_at: status === "SUCCEEDED" || status === "succeeded" ? new Date().toISOString() : null,
    };

    const { error } = await supabase.from("generated_models").upsert(row, {
      onConflict: "task_id",
    });

    if (error) {
      console.error("[meshy/webhook] upsert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("[meshy/webhook] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
