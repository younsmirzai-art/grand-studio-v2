import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient, createServerClient } from "@/lib/supabase/server";
import { getGenerationResult } from "@/lib/3d/generateAsset";
import type { ProviderId } from "@/lib/3d/providers/base";

export async function GET(request: NextRequest) {
  try {
    const supabaseAuth = await createServerAuthClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const generationId = request.nextUrl.searchParams.get("generationId");
    if (!generationId) {
      return NextResponse.json({ error: "generationId required" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data: row, error } = await supabase
      .from("generated_3d_assets")
      .select("*")
      .eq("id", generationId)
      .eq("user_id", user.id)
      .single();

    if (error || !row) {
      return NextResponse.json({ error: "Generation not found" }, { status: 404 });
    }

    const result = await getGenerationResult(
      row.provider as ProviderId,
      row.provider_job_id,
      row.prompt ?? undefined
    );

    if (result) {
      const isComplete =
        result.status === "complete" || result.status === "completed" || result.status === "SUCCEEDED";
      await supabase
        .from("generated_3d_assets")
        .update({
          status: isComplete ? "complete" : result.status === "failed" ? "failed" : row.status,
          preview_url: result.preview_url ?? row.preview_url,
          source_asset_url: result.asset_url ?? row.source_asset_url,
          source_file_type: result.file_type ?? row.source_file_type,
          raw_provider_response: (result.raw_response as object) ?? row.raw_provider_response,
          updated_at: new Date().toISOString(),
        })
        .eq("id", generationId);

      console.log("[tools/3d/result] Fetched.", {
        generationId,
        provider: result.provider,
        hasAsset: !!result.asset_url,
        hasPreview: !!result.preview_url,
      });
    }

    const updated = await supabase
      .from("generated_3d_assets")
      .select("*")
      .eq("id", generationId)
      .single();

    const out = updated.data ?? row;
    return NextResponse.json({
      id: out.id,
      provider: out.provider,
      provider_job_id: out.provider_job_id,
      status: out.status,
      prompt: out.prompt,
      preview_url: out.preview_url,
      asset_url: out.source_asset_url,
      file_type: out.source_file_type,
      error_message: result?.error_message ?? null,
      ue5_command_id: out.ue5_command_id,
      ue_asset_path: out.ue_asset_path,
      import_status: out.import_status,
      material_count: out.material_count,
      texture_count: out.texture_count,
      import_error: out.import_error,
      created_at: out.created_at,
      updated_at: out.updated_at,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[tools/3d/result] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
