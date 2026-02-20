import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerClient } from "@/lib/supabase/server";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key);
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  if (!webhookSecret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe/webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServerClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerEmail = session.customer_email ?? session.customer_details?.email ?? "";
      const subscriptionId = session.subscription as string | null;
      const tier = (session.metadata?.tier as string) ?? "pro";

      if (!customerEmail) break;

      if (subscriptionId) {
        const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
        const firstItem = subscription.items.data[0];
        const priceId = firstItem?.price.id ?? null;
        const periodEnd = firstItem?.current_period_end ?? subscription.billing_cycle_anchor;
        const currentPeriodEnd = new Date(periodEnd * 1000).toISOString();

        const row = {
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subscriptionId,
          customer_email: customerEmail,
          status: subscription.status === "active" ? "active" : subscription.status,
          tier,
          price_id: priceId,
          current_period_end: currentPeriodEnd,
          updated_at: new Date().toISOString(),
        };
        const { data: existing } = await supabase.from("subscriptions").select("id").eq("stripe_subscription_id", subscriptionId).maybeSingle();
        if (existing) {
          await supabase.from("subscriptions").update(row).eq("stripe_subscription_id", subscriptionId);
        } else {
          await supabase.from("subscriptions").insert(row);
        }
      }
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const subscriptionId = sub.id;
      const status = sub.status === "active" ? "active" : sub.status === "canceled" ? "canceled" : "past_due";
      const firstItem = sub.items?.data?.[0];
      const periodEnd = firstItem?.current_period_end ?? sub.billing_cycle_anchor;
      const currentPeriodEnd = new Date(periodEnd * 1000).toISOString();
      const priceId = firstItem?.price.id ?? null;
      const tier = (sub.metadata?.tier as string) ?? "pro";

      const { data: existing } = await supabase.from("subscriptions").select("id").eq("stripe_subscription_id", subscriptionId).maybeSingle();
      if (existing) {
        await supabase
          .from("subscriptions")
          .update({
            status,
            price_id: priceId,
            current_period_end: currentPeriodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscriptionId);
      } else {
        const customer = await getStripe().customers.retrieve(sub.customer as string);
        const customerEmail = (customer as Stripe.Customer).email ?? "";
        if (customerEmail) {
          await supabase.from("subscriptions").insert({
            stripe_customer_id: sub.customer,
            stripe_subscription_id: subscriptionId,
            customer_email: customerEmail,
            status,
            tier,
            price_id: priceId,
            current_period_end: currentPeriodEnd,
          });
        }
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
