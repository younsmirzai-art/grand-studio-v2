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
    const body = await req.json();
    const { sessionId } = body as { sessionId?: string };
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const session = await getStripe().checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });
    if (session.payment_status !== "paid" || session.mode !== "payment") {
      return NextResponse.json({ error: "Payment not completed" }, { status: 400 });
    }

    const listingId = session.metadata?.listingId;
    const buyerEmail = session.metadata?.buyerEmail;
    const sellerEmail = session.metadata?.sellerEmail;
    if (!listingId || !buyerEmail || !sellerEmail) {
      return NextResponse.json({ error: "Invalid session metadata" }, { status: 400 });
    }

    const amount = session.amount_total ? session.amount_total / 100 : 0;
    const commissionRate = 0.3;
    const commission = amount * commissionRate;
    const sellerPayout = amount - commission;

    const supabase = createServerClient();
    const { data: existing } = await supabase
      .from("game_purchases")
      .select("id")
      .eq("stripe_payment_id", sessionId)
      .maybeSingle();
    if (existing) {
      const { data: listing } = await supabase
        .from("game_store_listings")
        .select("download_url")
        .eq("id", listingId)
        .single();
      return NextResponse.json({
        alreadyRecorded: true,
        downloadUrl: (listing as { download_url?: string } | null)?.download_url ?? null,
      });
    }

    await supabase.from("game_purchases").insert({
      listing_id: listingId,
      buyer_email: buyerEmail,
      seller_email: sellerEmail,
      price: amount,
      commission,
      seller_payout: sellerPayout,
      stripe_payment_id: sessionId,
      status: "completed",
    });

    const { data: listing } = await supabase
      .from("game_store_listings")
      .select("download_count, revenue_total")
      .eq("id", listingId)
      .single();
    const current = listing as { download_count?: number; revenue_total?: number | string } | null;
    const prevRevenue = Number(current?.revenue_total ?? 0) || 0;
    const prevDownloads = Number(current?.download_count ?? 0) || 0;
    await supabase
      .from("game_store_listings")
      .update({
        download_count: prevDownloads + 1,
        revenue_total: prevRevenue + amount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", listingId);

    const { data: listing2 } = await supabase
      .from("game_store_listings")
      .select("download_url")
      .eq("id", listingId)
      .single();

    return NextResponse.json({
      success: true,
      downloadUrl: (listing2 as { download_url?: string } | null)?.download_url ?? null,
    });
  } catch (e) {
    console.error("[store/confirm-purchase] POST error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Confirmation failed" },
      { status: 500 }
    );
  }
}
