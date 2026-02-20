-- Stripe subscriptions (for billing / Phase 6)
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_customer_id text,
  stripe_subscription_id text,
  customer_email text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'incomplete')),
  tier text NOT NULL DEFAULT 'starter' CHECK (tier IN ('starter', 'pro', 'studio', 'enterprise')),
  price_id text,
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_email ON subscriptions(customer_email);
ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;
