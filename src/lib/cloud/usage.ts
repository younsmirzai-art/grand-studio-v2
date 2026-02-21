import { createServerClient } from "@/lib/supabase/server";

export async function getMonthlyMinutesUsed(userEmail: string): Promise<number> {
  if (!userEmail?.trim()) return 0;
  const supabase = createServerClient();
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const firstDay = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m + 1, 0);
  const lastDayStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;
  const { data } = await supabase
    .from("cloud_usage")
    .select("minutes_used")
    .eq("user_email", userEmail.trim())
    .gte("date", firstDay)
    .lte("date", lastDayStr);
  return (data ?? []).reduce((sum, row) => sum + (Number((row as { minutes_used?: number }).minutes_used) || 0), 0);
}
