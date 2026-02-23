import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Listing ID required" }, { status: 400 });

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("game_store_listings")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Listing not found" },
        { status: 404 }
      );
    }
    if (data.status !== "published") {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(data);
  } catch (e) {
    console.error("[store/listings/id] GET error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
