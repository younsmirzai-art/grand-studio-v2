import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const userEmail = new URL(req.url).searchParams.get("userEmail");
    if (!userEmail?.trim()) {
      return NextResponse.json({ error: "userEmail required" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data: listings } = await supabase
      .from("game_store_listings")
      .select("*")
      .eq("seller_email", userEmail.trim())
      .order("updated_at", { ascending: false });

    const { data: purchases } = await supabase
      .from("game_purchases")
      .select("price, commission, seller_payout, purchased_at")
      .eq("seller_email", userEmail.trim());

    const totalRevenue = (purchases ?? []).reduce((s, p) => s + Number((p as { price?: number }).price ?? 0), 0);
    const totalCommission = (purchases ?? []).reduce((s, p) => s + Number((p as { commission?: number }).commission ?? 0), 0);
    const totalEarnings = (purchases ?? []).reduce((s, p) => s + Number((p as { seller_payout?: number }).seller_payout ?? 0), 0);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthPurchases = (purchases ?? []).filter(
      (p) => new Date((p as { purchased_at?: string }).purchased_at ?? 0).toISOString() >= startOfMonth
    );
    const monthSales = monthPurchases.length;
    const monthRevenue = monthPurchases.reduce((s, p) => s + Number((p as { price?: number }).price ?? 0), 0);
    const monthDownloads = monthPurchases.length;

    return NextResponse.json({
      listings: listings ?? [],
      totalRevenue,
      totalCommission,
      totalEarnings,
      thisMonth: { sales: monthSales, revenue: monthRevenue, downloads: monthDownloads },
      purchasesByDay: getPurchasesByDay(purchases ?? []),
    });
  } catch (e) {
    console.error("[store/seller] GET error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}

function getPurchasesByDay(purchases: { purchased_at?: string; price?: number }[]): { date: string; revenue: number; count: number }[] {
  const byDay: Record<string, { revenue: number; count: number }> = {};
  for (const p of purchases) {
    const d = p.purchased_at ? new Date(p.purchased_at).toISOString().slice(0, 10) : "";
    if (!d) continue;
    if (!byDay[d]) byDay[d] = { revenue: 0, count: 0 };
    byDay[d].revenue += Number(p.price ?? 0);
    byDay[d].count += 1;
  }
  return Object.entries(byDay)
    .map(([date, v]) => ({ date, revenue: v.revenue, count: v.count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
