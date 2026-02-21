import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getSubscription, getMonthlyMinutesLimit } from "@/lib/cloud/subscription";
import { getMonthlyMinutesUsed } from "@/lib/cloud/usage";

export async function GET(req: Request) {
  try {
    const userEmail = new URL(req.url).searchParams.get("userEmail");
    if (!userEmail?.trim()) {
      return NextResponse.json(
        { error: "userEmail query param required" },
        { status: 400 }
      );
    }

    const sub = await getSubscription(userEmail.trim());
    const tier = sub?.tier ?? "starter";
    const limit = getMonthlyMinutesLimit(tier);
    const minutesUsed = await getMonthlyMinutesUsed(userEmail.trim());

    const supabase = createServerClient();
    const { data: sessions } = await supabase
      .from("cloud_sessions")
      .select("id, project_id, status, gpu_type, started_at, total_minutes_used, created_at")
      .eq("user_email", userEmail.trim())
      .order("created_at", { ascending: false })
      .limit(10);

    const nextReset = new Date();
    nextReset.setMonth(nextReset.getMonth() + 1);
    nextReset.setDate(1);
    nextReset.setHours(0, 0, 0, 0);

    return NextResponse.json({
      tier,
      minutesUsed,
      limit: limit >= 999999 ? null : limit,
      sessions: sessions ?? [],
      resetsOn: nextReset.toISOString().slice(0, 10),
    });
  } catch (e) {
    console.error("[cloud/usage] GET error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
