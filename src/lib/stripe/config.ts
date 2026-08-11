import Stripe from "stripe";
import { FREE_DAILY_LIMIT } from "@/lib/plans";

export { FREE_DAILY_LIMIT };

/**
 * Shared Stripe + plan constants for Phase 6.
 * Secret key must never be logged or exposed to the client.
 */
export const STRIPE_PRO_PRICE_ID =
  process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || "";

/** @deprecated Prefer STRIPE_PRO_PRICE_ID — kept for older callers */
export const STRIPE_PRICES = {
  PRO_MONTHLY: STRIPE_PRO_PRICE_ID || "price_TBD",
} as const;

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
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
