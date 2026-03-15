import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook not configured" },
      { status: 503 }
    );
  }

  const stripe = new Stripe(secret);

  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    const sig = request.headers.get("stripe-signature");
    if (!sig) {
      return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
    }
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  const supabase = createServerClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId = session.subscription as string | null;
        const customerId = session.customer as string | null;
        const userId = (session.metadata?.user_id ?? session.client_reference_id) as string | null;
        if (!userId) break;

        let plan: "pro" | "team" = "pro";
        let currentPeriodEnd: string | null = null;

        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const raw = sub as unknown as { current_period_end?: number };
          if (raw.current_period_end) {
            currentPeriodEnd = new Date(raw.current_period_end * 1000).toISOString();
          }
          const priceId = sub.items?.data?.[0]?.price?.id ?? "";
          if (priceId.includes("team")) plan = "team";
        }

        await supabase.from("subscriptions").upsert(
          {
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            plan,
            status: "active",
            current_period_end: currentPeriodEnd,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const subscriptionId = sub.id;
        const customerId = sub.customer as string;
        const status = sub.status === "active" ? "active" : sub.status === "past_due" ? "past_due" : "canceled";
        const rawSub = sub as unknown as { current_period_end?: number };
        const currentPeriodEnd = rawSub.current_period_end
          ? new Date(rawSub.current_period_end * 1000).toISOString()
          : null;
        let plan: "pro" | "team" = "pro";
        const priceId = sub.items?.data?.[0]?.price?.id;
        if (priceId && (priceId.includes("team") || priceId.includes("team_"))) plan = "team";

        const { data: existing } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", subscriptionId)
          .single();

        if (existing?.user_id) {
          await supabase
            .from("subscriptions")
            .update({
              plan,
              status,
              current_period_end: currentPeriodEnd ?? undefined,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", existing.user_id);
        } else {
          const customer = await stripe.customers.retrieve(customerId);
          const email = (customer as Stripe.Customer).email;
          if (email) {
            const { data: userByEmail } = await supabase.auth.admin.listUsers({ perPage: 1 });
            const user = userByEmail?.users?.find((u) => u.email === email);
            if (user) {
              await supabase.from("subscriptions").upsert(
                {
                  user_id: user.id,
                  stripe_customer_id: customerId,
                  stripe_subscription_id: subscriptionId,
                  plan,
                  status,
                  current_period_end: currentPeriodEnd ?? undefined,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "user_id" }
              );
            }
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const subscriptionId = sub.id;

        await supabase
          .from("subscriptions")
          .update({
            status: "canceled",
            stripe_subscription_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscriptionId);
        break;
      }

      default:
        break;
    }
  } catch (e) {
    console.error("[Stripe webhook]", e);
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
