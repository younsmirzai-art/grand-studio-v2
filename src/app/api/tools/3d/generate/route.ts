import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient, createServerClient } from "@/lib/supabase/server";
import { checkUsageLimit, recordUsage, getEffectivePlan } from "@/lib/usage/usageTracker";
import { createGeneration } from "@/lib/3d/generateAsset";
import type { ProviderId } from "@/lib/3d/providers/base";
import { isMasterpieceConfigured } from "@/lib/3d/providers/config";

const LIMIT_MSG =
  "You have used all your AI 3D Generator credits for today. Pro plan: 3/day, Team: 10/day. Upgrade for more!";

export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = await createServerAuthClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const plan = await getEffectivePlan(user.id);
    if (plan === "free") {
      return NextResponse.json(
        {
          error:
            "AI 3D Generator is available on Pro and Team plans. Upgrade to unlock!",
          limitReached: true,
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      prompt,
      provider,
      projectId,
      art_style,
      style,
    } = body as {
      prompt?: string;
      provider?: "meshy" | "masterpiece" | "auto";
      projectId?: string;
      art_style?: string;
      style?: string;
    };

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const providersToUse: ProviderId[] =
      provider === "auto"
        ? (["meshy", "masterpiece"] as ProviderId[]).filter((p) => {
            if (p === "masterpiece") return isMasterpieceConfigured();
            return true;
          })
        : provider === "masterpiece"
          ? ["masterpiece"]
          : ["meshy"];

    if (provider === "masterpiece" && !isMasterpieceConfigured()) {
      return NextResponse.json(
        { error: "Grand Forge is not configured for this environment." },
        { status: 503 }
      );
    }

    const supabase = createServerClient();
    const results: { generationId: string; provider: string; providerJobId: string; status: string }[] = [];

    for (const p of providersToUse) {
      const limitResult = await checkUsageLimit(user.id, "meshy_generate");
      if (!limitResult.allowed) {
        console.warn("[tools/3d/generate] Limit reached, skipping provider", p);
        continue;
      }

      try {
        console.log("[tools/3d/generate] Creating generation.", { provider: p, promptLength: prompt.length });
        const { jobId } = await createGeneration(p, prompt.trim(), {
          art_style: art_style || style,
          style: style || art_style,
        });
        await recordUsage(user.id, "meshy_generate");

        const { data: row, error } = await supabase
          .from("generated_3d_assets")
          .insert({
            user_id: user.id,
            project_id: projectId || null,
            prompt: prompt.trim(),
            provider: p,
            provider_job_id: jobId,
            status: "pending",
            updated_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (error) {
          console.error("[tools/3d/generate] DB insert failed", p, error);
          continue;
        }
        results.push({
          generationId: row.id,
          provider: p,
          providerJobId: jobId,
          status: "pending",
        });
        console.log("[tools/3d/generate] Job saved.", { generationId: row.id, provider: p });
      } catch (e) {
        console.error("[tools/3d/generate] Provider create failed", p, e);
      }
    }

    if (results.length === 0) {
      return NextResponse.json(
        { error: "Failed to start generation. Limit reached or provider error." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      results: results.length === 1 ? results[0] : results,
      provider: provider ?? "meshy",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[tools/3d/generate] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
