import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient, createServerClient } from "@/lib/supabase/server";
import { getTaskStatus, getImageTo3DStatus, getRetextureStatus, getTextToImageStatus } from "@/lib/meshy/client";

export async function GET(request: NextRequest) {
  try {
    const taskId = request.nextUrl.searchParams.get("taskId");
    const mode = request.nextUrl.searchParams.get("mode") ?? "text-to-3d";
    if (!taskId) {
      return NextResponse.json({ error: "taskId required" }, { status: 400 });
    }

    const supabaseAuth = await createServerAuthClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    const supabase = user ? createServerClient() : null;

    async function mirrorToSupabase(modelUrl?: string, thumbUrl?: string) {
      if (!user || !supabase || !modelUrl) return modelUrl;
      // Only mirror Meshy-hosted URLs; skip if already on our storage
      if (!modelUrl.includes("meshy.ai") && !modelUrl.includes("assets.")) return modelUrl;
      try {
        const modelRes = await fetch(modelUrl);
        if (modelRes.ok) {
          const buf = await modelRes.arrayBuffer();
          const path = `${user.id}/${taskId}.glb`;
          const { data: uploadData, error } = await supabase.storage
            .from("generated-models")
            .upload(path, buf, {
              contentType: "model/gltf-binary",
              upsert: true,
            });
          if (!error && uploadData?.path) {
            const { data: urlData } = supabase.storage.from("generated-models").getPublicUrl(uploadData.path);
            modelUrl = urlData.publicUrl;
          }
        }

        let finalThumbUrl = thumbUrl;
        if (thumbUrl && (thumbUrl.includes("meshy.ai") || thumbUrl.includes("assets."))) {
          const thumbRes = await fetch(thumbUrl);
          if (thumbRes.ok) {
            const buf = await thumbRes.arrayBuffer();
            const path = `${user.id}/${taskId}-thumb.png`;
            const { data: uploadData, error } = await supabase.storage
              .from("generated-models")
              .upload(path, buf, {
                contentType: "image/png",
                upsert: true,
              });
            if (!error && uploadData?.path) {
              const { data: urlData } = supabase.storage.from("generated-models").getPublicUrl(uploadData.path);
              finalThumbUrl = urlData.publicUrl;
            }
          }
        }

        if (modelUrl || finalThumbUrl) {
          await supabase
            .from("generated_models")
            .update({
              ...(modelUrl ? { model_url: modelUrl } : {}),
              ...(finalThumbUrl ? { thumbnail_url: finalThumbUrl } : {}),
            })
            .eq("task_id", taskId)
            .eq("user_id", user.id);
        }

        return modelUrl;
      } catch (e) {
        console.error("[meshy/status] mirrorToSupabase error", e);
        return modelUrl;
      }
    }

    if (mode === "texture") {
      const result = await getRetextureStatus(taskId);
      let modelUrl = result.status === "SUCCEEDED" && result.model_urls?.glb
        ? result.model_urls.glb
        : undefined;
      if (result.status === "SUCCEEDED") {
        const thumbUrl = (result as any).thumbnail_url as string | undefined;
        modelUrl = await mirrorToSupabase(modelUrl, thumbUrl);
      }
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
      let modelUrl = result.status === "SUCCEEDED" && result.model_urls?.glb
        ? result.model_urls.glb
        : undefined;
      if (result.status === "SUCCEEDED") {
        const thumbUrl = (result as any).thumbnail_url as string | undefined;
        modelUrl = await mirrorToSupabase(modelUrl, thumbUrl);
      }
      return NextResponse.json({
        status: result.status,
        progress: result.progress,
        modelUrl,
      });
    }

    const result = await getTaskStatus(taskId);
    let modelUrl = result.status === "SUCCEEDED" && result.model_urls?.glb
      ? result.model_urls.glb
      : undefined;
    if (result.status === "SUCCEEDED") {
      const thumbUrl = (result as any).thumbnail_url as string | undefined;
      modelUrl = await mirrorToSupabase(modelUrl, thumbUrl);
    }
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
