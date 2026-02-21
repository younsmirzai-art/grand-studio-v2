import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { validateApiKey, unauthorizedResponse } from "@/lib/api/auth";

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) return unauthorizedResponse();

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("game_templates")
      .select("id, name, description, category, tags, is_free, is_official, is_featured, difficulty, estimated_build_time, download_count, rating, rating_count")
      .order("download_count", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      templates: data ?? [],
    });
  } catch (error) {
    console.error("[v1/templates]", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
