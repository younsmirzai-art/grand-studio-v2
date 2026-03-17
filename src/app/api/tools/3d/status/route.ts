import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient, createServerClient } from "@/lib/supabase/server";
import { getGenerationStatus } from "@/lib/3d/generateAsset";
import type { ProviderId } from "@/lib/3d/providers/base";

export async function GET(request: NextRequest) {
  try {
    const supabaseAuth = await createServerAuthClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const generationId = request.nextUrl.searchParams.get("generationId");
    const provider = request.nextUrl.searchParams.get("provider") as ProviderId | null;
    const providerJobId = request.nextUrl.searchParams.get("providerJobId");

    if (generationId) {
      const supabase = createServerClient();
      const { data: row, error } = await supabase
        .from("generated_3d_assets")
        .select("id, provider, provider_job_id, prompt, status")
        .eq("id", generationId)
        .eq("user_id", user.id)
        .single();

      if (error || !row) {
        return NextResponse.json({ error: "Generation not found" }, { status: 404 });
      }

      const statusResult = await getGenerationStatus(
        row.provider as ProviderId,
        row.provider_job_id
      );
      const normalizedStatus =
        statusResult.status === "complete" || statusResult.status === "SUCCEEDED"
          ? "complete"
          : statusResult.status === "failed" || statusResult.status === "FAILED"
            ? "failed"
            : "pending";

      await supabase
        .from("generated_3d_assets")
        .update({
          status: normalizedStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", generationId);

      console.log("[tools/3d/status] Polled.", { generationId, status: normalizedStatus });
      return NextResponse.json({
        generationId: row.id,
        provider: row.provider,
        providerJobId: row.provider_job_id,
        status: normalizedStatus,
        progress: statusResult.progress,
      });
    }

    if (provider && providerJobId) {
      const statusResult = await getGenerationStatus(provider, providerJobId);
      return NextResponse.json({
        provider,
        providerJobId,
        status: statusResult.status,
        progress: statusResult.progress,
      });
    }

    return NextResponse.json(
      { error: "generationId or (provider + providerJobId) required" },
      { status: 400 }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[tools/3d/status] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
