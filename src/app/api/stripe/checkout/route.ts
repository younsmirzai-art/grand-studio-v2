import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key);
}

const TIER_PRICE_IDS: Record<string, string> = {
  pro: process.env.STRIPE_PRICE_ID_PRO ?? "",
  studio: process.env.STRIPE_PRICE_ID_STUDIO ?? "",
  enterprise: process.env.STRIPE_PRICE_ID_ENTERPRISE ?? "",
};

export async function POST(request: NextRequest) {
  try {
    const { tier } = await request.json();

    if (!tier || !TIER_PRICE_IDS[tier]) {
      return NextResponse.json(
        { error: "Invalid tier. Use pro, studio, or enterprise." },
        { status: 400 }
      );
    }

    const priceId = TIER_PRICE_IDS[tier];
    if (!priceId) {
      return NextResponse.json(
        { error: "Stripe price not configured for this tier." },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;

    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/#pricing`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { tier },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[stripe/checkout] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed" },
      { status: 500 }
    );
  }
}
