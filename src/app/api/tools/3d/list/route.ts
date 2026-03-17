import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient, createServerClient } from "@/lib/supabase/server";

/** GET — list user's generated_3d_assets for display with import badges. */
export async function GET(request: NextRequest) {
  try {
    const supabaseAuth = await createServerAuthClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = Math.min(Number(request.nextUrl.searchParams.get("limit")) || 30, 50);
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("generated_3d_assets")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ generations: data ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
