import Stripe from "stripe";
import { FREE_DAILY_LIMIT } from "@/lib/plans";

export { FREE_DAILY_LIMIT };

/**
 * Read Pro price ID at call-time (not module load).
 * Prefers server-only STRIPE_PRO_PRICE_ID, falls back to NEXT_PUBLIC_*.
 */
export function getStripeProPriceId(): string {
  const value =
    process.env.STRIPE_PRO_PRICE_ID?.trim() ||
    process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID?.trim() ||
    "";
  return value;
}

/** @deprecated Prefer getStripeProPriceId() */
export const STRIPE_PRO_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || "";

/** @deprecated Prefer getStripeProPriceId() */
export const STRIPE_PRICES = {
  get PRO_MONTHLY() {
    return getStripeProPriceId() || "price_TBD";
  },
} as const;

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

/** Lazy Stripe singleton (throws if secret missing when first used). */
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    const client = getStripe() as unknown as Record<PropertyKey, unknown>;
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
