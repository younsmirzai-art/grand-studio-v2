import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const listingId = new URL(req.url).searchParams.get("listingId");
    if (!listingId) {
      return NextResponse.json({ error: "listingId required" }, { status: 400 });
    }
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("game_reviews")
      .select("*")
      .eq("listing_id", listingId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ reviews: data ?? [] });
  } catch (e) {
    console.error("[store/reviews] GET error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { listingId, reviewerEmail, rating, title, reviewText } = body as {
      listingId?: string;
      reviewerEmail?: string;
      rating?: number;
      title?: string;
      reviewText?: string;
    };
    if (!listingId || !reviewerEmail?.trim() || rating == null) {
      return NextResponse.json(
        { error: "listingId, reviewerEmail, and rating required" },
        { status: 400 }
      );
    }
    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating must be 1-5" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data: purchased } = await supabase
      .from("game_purchases")
      .select("id")
      .eq("listing_id", listingId)
      .eq("buyer_email", reviewerEmail.trim())
      .maybeSingle();
    if (!purchased) {
      return NextResponse.json(
        { error: "Only buyers can review this game" },
        { status: 403 }
      );
    }

    const { data: existing } = await supabase
      .from("game_reviews")
      .select("id")
      .eq("listing_id", listingId)
      .eq("reviewer_email", reviewerEmail.trim())
      .maybeSingle();
    if (existing) {
      await supabase
        .from("game_reviews")
        .update({
          rating: Math.round(rating),
          title: title?.trim() ?? null,
          review_text: reviewText?.trim() ?? null,
        })
        .eq("id", existing.id);
    } else {
      const { error: insertErr } = await supabase.from("game_reviews").insert({
        listing_id: listingId,
        reviewer_email: reviewerEmail.trim(),
        rating: Math.round(rating),
        title: title?.trim() ?? null,
        review_text: reviewText?.trim() ?? null,
      });
      if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    const { data: reviews } = await supabase
      .from("game_reviews")
      .select("rating")
      .eq("listing_id", listingId);
    const count = reviews?.length ?? 0;
    const avg = count ? (reviews as { rating: number }[]).reduce((s, r) => s + r.rating, 0) / count : 0;
    const newRating = Math.round(avg * 10) / 10;
    await supabase
      .from("game_store_listings")
      .update({ rating: newRating, rating_count: count, updated_at: new Date().toISOString() })
      .eq("id", listingId);

    return NextResponse.json({ success: true, rating: newRating, rating_count: count });
  } catch (e) {
    console.error("[store/reviews] POST error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
