import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient, createServerClient } from "@/lib/supabase/server";

// Simple status endpoint: reads audio URL from generated_music (no polling).
export async function GET(request: NextRequest) {
  try {
    const supabaseAuth = await createServerAuthClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const trackId = request.nextUrl.searchParams.get("id");

    const supabase = createServerClient();

    const query = supabase
      .from("generated_music")
      .select("id, status, audio_url")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    const { data, error } = trackId
      ? await supabase
          .from("generated_music")
          .select("id, status, audio_url")
          .eq("user_id", user.id)
          .eq("id", trackId)
          .maybeSingle()
      : await query.maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ status: "not_found", audioUrl: null }, { status: 404 });
    }

    return NextResponse.json({
      status: data.status ?? "completed",
      audioUrl: data.audio_url ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
