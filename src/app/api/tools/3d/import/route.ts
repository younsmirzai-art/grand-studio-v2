/**
 * Import a generated 3D asset into UE5 using the SAME pipeline as Meshy/Sketchfab/Poly Haven.
 * Queues ue5_commands with commandType='import' and importContext; relay + IMPORT_RESULT fill ue5_import_assets.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient, createServerClient } from "@/lib/supabase/server";
import { generateUE5ImportCode } from "@/lib/ue5/importCode";
import { queueUE5Command } from "@/lib/ue5/commands";

export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = await createServerAuthClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { generationId, projectId } = body as { generationId?: string; projectId?: string };

    if (!generationId || !projectId) {
      return NextResponse.json(
        { error: "generationId and projectId required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const { data: row, error } = await supabase
      .from("generated_3d_assets")
      .select("id, provider, provider_job_id, source_asset_url, source_file_type, preview_url, prompt")
      .eq("id", generationId)
      .eq("user_id", user.id)
      .single();

    if (error || !row) {
      return NextResponse.json({ error: "Generation not found" }, { status: 404 });
    }

    const assetUrl = row.source_asset_url;
    if (!assetUrl) {
      return NextResponse.json(
        { error: "Model not ready or generation not complete. Poll status/result first." },
        { status: 400 }
      );
    }

    const fileType = row.source_file_type || "glb";
    const ext = fileType === "fbx" ? "fbx" : "glb";
    const filename = `${row.provider}-${row.provider_job_id.slice(0, 8)}.${ext}`;
    const label = "AIGenerated";

    console.log("[tools/3d/import] Queuing UE5 import.", {
      generationId,
      provider: row.provider,
      assetUrl: assetUrl.slice(0, 60) + "...",
    });

    const code = generateUE5ImportCode(assetUrl, filename, label);
    const commandId = await queueUE5Command(projectId, code, {
      commandType: "import",
      importContext: {
        source_provider: row.provider,
        source_url: assetUrl,
        file_type: ext,
        ...(row.preview_url ? { preview_image_url: row.preview_url } : {}),
      },
    });

    await supabase
      .from("generated_3d_assets")
      .update({
        project_id: projectId,
        ue5_command_id: commandId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", generationId);

    console.log("[tools/3d/import] Import queued.", { generationId, commandId });
    return NextResponse.json({ success: true, commandId });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[tools/3d/import] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
