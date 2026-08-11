import { NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/server";
import { FREE_DAILY_LIMIT } from "@/lib/plans";

export async function GET() {
  try {
    const supabase = await createServerAuthClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan, status, current_period_end, cancel_at_period_end")
      .eq("user_id", user.id)
      .maybeSingle();

    const isPro = sub?.plan === "pro" && sub?.status === "active";
    const tier = isPro ? "pro" : "free";

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const [todayRes, totalRes, favRes] = await Promise.all([
      supabase
        .from("downloads")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("downloaded_at", startOfDay.toISOString()),
      supabase
        .from("downloads")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("favorites")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);

    const downloadsToday = todayRes.count || 0;

    return NextResponse.json({
      tier,
      plan: tier,
      status: sub?.status || "active",
      currentPeriodEnd: sub?.current_period_end || null,
      cancelAtPeriodEnd: sub?.cancel_at_period_end || false,
      downloadsToday,
      totalDownloads: totalRes.count || 0,
      favoritesCount: favRes.count || 0,
      dailyLimit: isPro ? null : FREE_DAILY_LIMIT,
      remaining: isPro
        ? null
        : Math.max(0, FREE_DAILY_LIMIT - downloadsToday),
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
