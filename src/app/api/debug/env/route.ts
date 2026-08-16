import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasStripePublishable: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    hasStripeSecret: !!process.env.STRIPE_SECRET_KEY,
    hasStripePriceId: !!process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
    hasStripePriceIdServer: !!process.env.STRIPE_PRO_PRICE_ID,
    hasStripeWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
    hasSiteUrl: !!process.env.NEXT_PUBLIC_SITE_URL,

    siteUrlValue: process.env.NEXT_PUBLIC_SITE_URL || "MISSING",
    supabaseUrlValue: process.env.NEXT_PUBLIC_SUPABASE_URL || "MISSING",
    priceIdValue: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || "MISSING",
    priceIdServerPrefix: (process.env.STRIPE_PRO_PRICE_ID || "").startsWith(
      "price_"
    ),

    supabaseAnonKeyLength: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "")
      .length,
    supabaseServiceKeyLength: (process.env.SUPABASE_SERVICE_ROLE_KEY || "")
      .length,
    stripePublishableLength: (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "")
      .length,
    stripeSecretLength: (process.env.STRIPE_SECRET_KEY || "").length,
    stripeWebhookLength: (process.env.STRIPE_WEBHOOK_SECRET || "").length,

    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  });
}
