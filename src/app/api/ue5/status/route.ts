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

    const isRelayOnline =
      heartbeat &&
      heartbeat.length > 0 &&
      Date.now() - new Date(heartbeat[0].last_ping as string).getTime() < 30000;

    return NextResponse.json({
      relay_online: isRelayOnline,
      last_command: data?.[0] ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { relay_online: false, error: String(error) },
      { status: 500 }
    );
  }
}
