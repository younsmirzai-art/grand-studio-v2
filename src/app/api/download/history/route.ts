import { NextResponse } from "next/server";
import { createServerAuthClient, createServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabaseAuth = await createServerAuthClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("user_downloads")
      .select("id, asset_name, asset_source, asset_id, download_url, file_size, downloaded_at")
      .eq("user_id", user.id)
      .order("downloaded_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ items: data ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
