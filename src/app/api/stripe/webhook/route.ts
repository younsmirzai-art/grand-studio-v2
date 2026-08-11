import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/config";
import { createServerClient } from "@/lib/supabase/server";

function periodEndIso(subscription: Stripe.Subscription): string | null {
  const raw = subscription as unknown as { current_period_end?: number };
  if (!raw.current_period_end) return null;
  return new Date(raw.current_period_end * 1000).toISOString();
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServerClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId =
          session.metadata?.user_id ||
          (session.client_reference_id as string | null);
        if (!userId || !session.subscription) {
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );

        await supabase.from("subscriptions").upsert(
          {
            user_id: userId,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscription.id,
            stripe_price_id: subscription.items.data[0]?.price.id ?? null,
            plan: "pro",
            status: subscription.status,
            current_period_end: periodEndIso(subscription),
            cancel_at_period_end: subscription.cancel_at_period_end ?? false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        let { data: sub } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", subscription.id)
          .maybeSingle();

        if (!sub) {
          const byCustomer = await supabase
            .from("subscriptions")
            .select("user_id")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();
          sub = byCustomer.data;
        }

        if (!sub?.user_id) break;

        const isActive =
          subscription.status === "active" ||
          subscription.status === "trialing";

        if (event.type === "customer.subscription.deleted") {
          await supabase
            .from("subscriptions")
            .update({
              plan: "free",
              status: "canceled",
              stripe_subscription_id: null,
              cancel_at_period_end: false,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", sub.user_id);
        } else {
          await supabase
            .from("subscriptions")
            .update({
              stripe_subscription_id: subscription.id,
              stripe_price_id: subscription.items.data[0]?.price.id ?? null,
              plan: isActive ? "pro" : "free",
              status: subscription.status,
              current_period_end: periodEndIso(subscription),
              cancel_at_period_end: subscription.cancel_at_period_end ?? false,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", sub.user_id);
        }
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[stripe/webhook] handler error");
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }
}
