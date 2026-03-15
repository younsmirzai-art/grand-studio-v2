import { createServerClient } from "@/lib/supabase/server";

const PLAN_LIMITS: Record<string, Record<string, number>> = {
  free: {
    ai_message: 10,
    polyhaven_import: 5,
    sketchfab_import: 3,
    screenshot: 5,
    max_projects: 2,
  },
  pro: {
    ai_message: 99999,
    polyhaven_import: 99999,
    sketchfab_import: 99999,
    screenshot: 99999,
    max_projects: 10,
  },
  team: {
    ai_message: 99999,
    polyhaven_import: 99999,
    sketchfab_import: 99999,
    screenshot: 99999,
    max_projects: 99999,
  },
};

export type UsageActionType =
  | "ai_message"
  | "polyhaven_import"
  | "sketchfab_import"
  | "screenshot"
  | "max_projects";

export interface UsageLimitResult {
  allowed: boolean;
  used: number;
  limit: number;
  plan: string;
}

/** Get effective plan: only 'active' subscription with current_period_end in future counts as pro/team. */
async function getEffectivePlan(userId: string): Promise<"free" | "pro" | "team"> {
  const supabase = createServerClient();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  if (!sub || sub.status !== "active") return "free";
  if (sub.current_period_end) {
    const end = new Date(sub.current_period_end);
    if (end.getTime() < Date.now()) return "free";
  }
  return (sub.plan === "team" ? "team" : sub.plan === "pro" ? "pro" : "free") as "free" | "pro" | "team";
}

/** Start of today in UTC (for daily counts). */
function todayUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Check if the user is within their usage limit for the given action.
 * For max_projects, "used" is the current project count (from projects table), not usage_logs.
 */
export async function checkUsageLimit(
  userId: string,
  actionType: UsageActionType
): Promise<UsageLimitResult> {
  const supabase = createServerClient();
  const plan = await getEffectivePlan(userId);
  const limit = PLAN_LIMITS[plan]?.[actionType] ?? 0;

  if (actionType === "max_projects") {
    const { count } = await supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    const used = count ?? 0;
    return {
      allowed: used < limit,
      used,
      limit,
      plan,
    };
  }

  const since = todayUTC().toISOString();
  const { count } = await supabase
    .from("usage_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("action_type", actionType)
    .gte("created_at", since);

  const used = count ?? 0;
  return {
    allowed: used < limit,
    used,
    limit,
    plan,
  };
}

/** Record one usage of the given action (inserts into usage_logs). Not used for max_projects. */
export async function recordUsage(userId: string, actionType: UsageActionType): Promise<void> {
  if (actionType === "max_projects") return;
  const supabase = createServerClient();
  await supabase.from("usage_logs").insert({
    user_id: userId,
    action_type: actionType,
  });
}
