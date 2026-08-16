import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerAuthClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerAuthClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    console.log("[create-checkout] user session:", user ? { id: user.id, email: user.email } : "none");
    if (authError) {
      console.log("[create-checkout] auth error:", authError.message, authError);
    }

    if (!user) {
      console.log("[create-checkout] Unauthorized: no user session (cookies may not be sent or session expired)");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { priceId } = body as { priceId?: string };
    console.log("[create-checkout] body priceId:", priceId);
    if (!priceId || typeof priceId !== "string") {
      return NextResponse.json(
        { error: "Missing priceId" },
        { status: 400 }
      );
    }

    const stripe = new Stripe(secret);
    const origin = request.headers.get("origin") || request.nextUrl.origin;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/pricing/success`,
      cancel_url: `${origin}/#pricing`,
      customer_email: user.email ?? undefined,
      client_reference_id: user.id,
      subscription_data: {
        metadata: { user_id: user.id },
      },
    });

    console.log("[create-checkout] session created, url:", session.url ? "yes" : "no");
    return NextResponse.json({
      url: session.url,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[create-checkout] error:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
