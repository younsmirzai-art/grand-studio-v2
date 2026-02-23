import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { listingId, sellerEmail, ...updates } = body as Record<string, unknown>;
    if (!listingId || !String(sellerEmail ?? "").trim()) {
      return NextResponse.json(
        { error: "listingId and sellerEmail required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const { data: existing } = await supabase
      .from("game_store_listings")
      .select("seller_email")
      .eq("id", listingId)
      .single();
    if (!existing || (existing as { seller_email?: string }).seller_email !== String(sellerEmail ?? "").trim()) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const allowed: Record<string, unknown> = {};
    const keys = ["title", "description", "long_description", "genre", "tags", "price", "is_free", "thumbnail_url", "screenshots", "trailer_url", "download_url", "file_size_mb", "platforms", "system_requirements", "status"];
    for (const k of keys) {
      if (updates[k] !== undefined) allowed[k] = updates[k];
    }
    if (allowed.status === "published") {
      (allowed as Record<string, unknown>).published_at = new Date().toISOString();
    }
    (allowed as Record<string, unknown>).updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("game_store_listings")
      .update(allowed)
      .eq("id", listingId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e) {
    console.error("[store/listings/update] PATCH error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
