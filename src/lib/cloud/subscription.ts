import { createServerClient } from "@/lib/supabase/server";

export type Tier = "starter" | "pro" | "studio" | "enterprise";

export interface Subscription {
  tier: Tier;
  status: string;
  current_period_end?: string;
}

export async function getSubscription(userEmail: string): Promise<Subscription | null> {
  if (!userEmail?.trim()) return null;
  const supabase = createServerClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("tier, status, current_period_end")
    .eq("customer_email", userEmail.trim().toLowerCase())
    .eq("status", "active")
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    tier: (data.tier as Tier) ?? "starter",
    status: data.status as string,
    current_period_end: data.current_period_end as string | undefined,
  };
}

export function getMonthlyMinutesLimit(tier: Tier): number {
  switch (tier) {
    case "pro":
      return 60;
    case "studio":
      return 300;
    case "enterprise":
      return 999999;
    default:
      return 0;
  }
}
