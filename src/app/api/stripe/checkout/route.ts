import { NextRequest, NextResponse } from "next/server";
import {
  assertRecurringPrice,
  getStripe,
  getStripeProPriceId,
  parseBillingInterval,
} from "@/lib/stripe/config";
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

    let interval = parseBillingInterval(undefined);
    try {
      const body = (await request.json()) as { interval?: unknown };
      interval = parseBillingInterval(body.interval);
    } catch {
      // Empty body is fine — default to monthly.
    }

    const priceId = getStripeProPriceId(interval);
    if (!priceId) {
      console.error(
        "[stripe/checkout] missing price id for interval:",
        interval
      );
      return NextResponse.json(
        {
          error:
            interval === "year"
              ? "Annual Stripe price not configured"
              : "Stripe price not configured",
        },
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
    const stripe = getStripe();
    await assertRecurringPrice(stripe, priceId);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer: existingSub?.stripe_customer_id || undefined,
      customer_email: existingSub?.stripe_customer_id
        ? undefined
        : user.email || undefined,
      client_reference_id: user.id,
      metadata: { user_id: user.id, billing_interval: interval },
      subscription_data: {
        metadata: { user_id: user.id, billing_interval: interval },
      },
      success_url: `${origin}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?canceled=true`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error(
      "[stripe/checkout] failed:",
      error instanceof Error ? error.message : "unknown"
    );
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to start checkout",
      },
      { status: 500 }
    );
  }
}
