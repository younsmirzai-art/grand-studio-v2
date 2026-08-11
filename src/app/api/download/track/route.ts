import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/server";
import { FREE_DAILY_LIMIT } from "@/lib/plans";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerAuthClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = (await request.json()) as {
      modelId?: string;
      modelName?: string;
      modelThumbnail?: string;
      format?: string;
      fileSizeBytes?: number;
      categories?: string[];
      tags?: string[];
    };

    const { modelId, modelName, format } = body;
    if (!modelId || !modelName || !format) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan, status")
      .eq("user_id", user.id)
      .maybeSingle();

    const isPro = sub?.plan === "pro" && sub?.status === "active";

    if (!isPro) {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);

      const { count } = await supabase
        .from("downloads")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("downloaded_at", startOfDay.toISOString());

      if ((count || 0) >= FREE_DAILY_LIMIT) {
        return NextResponse.json(
          {
            error: "Daily limit reached",
            limit: FREE_DAILY_LIMIT,
            used: count,
            upgradeUrl: "/pricing",
          },
          { status: 429 }
        );
      }
    }

    const { error } = await supabase.from("downloads").insert({
      user_id: user.id,
      model_id: modelId,
      model_name: modelName,
      model_thumbnail: body.modelThumbnail || null,
      model_source: "polyhaven",
      format,
      file_size_bytes: body.fileSizeBytes || null,
      categories: body.categories || [],
      tags: body.tags || [],
    });

    if (error) {
      console.error("[download/track] insert failed");
      return NextResponse.json({ error: "Failed to record" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
