import { createServerClient } from "@/lib/supabase/server";

/** Mirrors GET /api/ue5/status relay_online check. */
export async function isRelayOnline(): Promise<boolean> {
  try {
    const supabase = createServerClient();
    const { data: heartbeat } = await supabase
      .from("relay_heartbeat")
      .select("*")
      .order("last_ping", { ascending: false })
      .limit(1);

    const row = heartbeat?.[0] as { last_ping?: string; ue5_connected?: boolean } | undefined;
    const pingAge = row?.last_ping ? Date.now() - new Date(row.last_ping).getTime() : Infinity;
    return pingAge < 60_000 && row?.ue5_connected === true;
  } catch {
    return false;
  }
}
