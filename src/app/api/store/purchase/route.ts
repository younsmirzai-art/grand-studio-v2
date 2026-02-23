import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import Stripe from "stripe";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key);
}

export async function POST(req: Request) {
  try {
    const { listingId, buyerEmail } = await req.json();
    if (!listingId || !buyerEmail?.trim()) {
      return NextResponse.json({ error: "listingId and buyerEmail required" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data: listing, error: fetchErr } = await supabase
      .from("game_store_listings")
      .select("*")
      .eq("id", listingId)
      .single();

    if (fetchErr || !listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }
    if ((listing as { status?: string }).status !== "published") {
      return NextResponse.json({ error: "Listing not available" }, { status: 400 });
    }

    const L = listing as {
      is_free?: boolean;
      price?: number;
      seller_email?: string;
      download_url?: string;
      download_count?: number;
      title?: string;
      description?: string;
      thumbnail_url?: string;
      currency?: string;
    };

    if (L.is_free || Number(L.price) === 0) {
      await supabase.from("game_purchases").insert({
        listing_id: listingId,
        buyer_email: buyerEmail.trim(),
        seller_email: L.seller_email,
        price: 0,
        commission: 0,
        seller_payout: 0,
        status: "completed",
      });
      await supabase
        .from("game_store_listings")
        .update({
          download_count: (Number(L.download_count) || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", listingId);
      return NextResponse.json({ free: true, downloadUrl: L.download_url ?? null });
    }

    const priceCents = Math.round(Number(L.price) * 100);
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://grand-studio-v2-prod.vercel.app";

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: L.currency || "usd",
          product_data: {
            name: L.title ?? "Game",
            description: String(L.description ?? "").slice(0, 200) || undefined,
            images: L.thumbnail_url ? [L.thumbnail_url] : undefined,
          },
          unit_amount: priceCents,
        },
        quantity: 1,
      }],
      success_url: `${baseUrl}/store/${listingId}?purchased=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/store/${listingId}`,
      metadata: { listingId, buyerEmail: buyerEmail.trim(), sellerEmail: L.seller_email ?? "" },
    });

    return NextResponse.json({ free: false, checkoutUrl: session.url });
  } catch (e) {
    console.error("[store/purchase] POST error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Purchase failed" },
      { status: 500 }
    );
  }
}
