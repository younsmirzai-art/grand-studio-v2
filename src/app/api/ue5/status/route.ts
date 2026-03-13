import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createServerClient();

    const { data } = await supabase
      .from("ue5_commands")
      .select("status, executed_at")
      .order("created_at", { ascending: false })
      .limit(1);

    const { data: heartbeat } = await supabase
      .from("relay_heartbeat")
      .select("*")
      .order("last_ping", { ascending: false })
      .limit(1);

    const row = heartbeat?.[0] as { last_ping?: string; ue5_connected?: boolean } | undefined;
    const pingAge = row?.last_ping
      ? Date.now() - new Date(row.last_ping).getTime()
      : Infinity;

    const isRelayOnline = pingAge < 60_000 && row?.ue5_connected === true;

    return NextResponse.json({
      relay_online: isRelayOnline,
      last_ping: row?.last_ping ?? null,
      ue5_connected: row?.ue5_connected ?? false,
      ping_age_ms: pingAge === Infinity ? null : Math.round(pingAge),
      last_command: data?.[0] ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { relay_online: false, error: String(error) },
      { status: 500 }
    );
  }
}
