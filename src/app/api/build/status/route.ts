import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const commandId = request.nextUrl.searchParams.get("commandId");
    if (!commandId) {
      return NextResponse.json({ error: "Missing commandId" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("ue5_commands")
      .select("status, result, error_log, screenshot_url")
      .eq("id", commandId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Command not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: data.status,
      result: data.result,
      error_log: data.error_log,
      screenshot_url: data.screenshot_url ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
