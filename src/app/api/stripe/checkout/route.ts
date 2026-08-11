import { NextRequest, NextResponse } from "next/server";
import { stripe, STRIPE_PRO_PRICE_ID } from "@/lib/stripe/config";
import {
  createServerAuthClient,
  createServerClient,
} from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = await createServerAuthClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (!STRIPE_PRO_PRICE_ID) {
      return NextResponse.json(
        { error: "Stripe price not configured" },
        { status: 500 }
      );
    }

    const admin = createServerClient();
    const { data: existingSub } = await admin
      .from("subscriptions")
      .select("stripe_customer_id, plan, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingSub?.plan === "pro" && existingSub?.status === "active") {
      return NextResponse.json({ error: "Already Pro" }, { status: 400 });
    }

    const origin = request.nextUrl.origin;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: STRIPE_PRO_PRICE_ID, quantity: 1 }],
      customer: existingSub?.stripe_customer_id || undefined,
      customer_email: existingSub?.stripe_customer_id
        ? undefined
        : user.email || undefined,
      client_reference_id: user.id,
      metadata: { user_id: user.id },
      subscription_data: {
        metadata: { user_id: user.id },
      },
      success_url: `${origin}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?canceled=true`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[stripe/checkout] failed");
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to start checkout",
      },
      { status: 500 }
    );
  }
}
