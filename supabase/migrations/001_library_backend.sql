-- Phase 6: Library backend (downloads, favorites) + subscription extensions
-- NOTE: `public.subscriptions` already exists with column `plan` (free|pro|team).
-- We keep `plan` as the source of truth (maps to "tier" in app APIs) and add missing Stripe fields.

-- Downloads table (marketplace download history + rate limiting)
CREATE TABLE IF NOT EXISTS public.downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  model_source TEXT NOT NULL DEFAULT 'polyhaven',
  model_thumbnail TEXT,
  format TEXT NOT NULL,
  file_size_bytes BIGINT,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  categories TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_downloads_user_date
  ON public.downloads(user_id, downloaded_at DESC);

ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own downloads" ON public.downloads;
CREATE POLICY "Users view own downloads"
  ON public.downloads FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own downloads" ON public.downloads;
CREATE POLICY "Users insert own downloads"
  ON public.downloads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Favorites table
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  model_source TEXT NOT NULL DEFAULT 'polyhaven',
  model_thumbnail TEXT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, model_id, model_source)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user
  ON public.favorites(user_id, added_at DESC);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own favorites" ON public.favorites;
CREATE POLICY "Users view own favorites"
  ON public.favorites FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users add own favorites" ON public.favorites;
CREATE POLICY "Users add own favorites"
  ON public.favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users remove own favorites" ON public.favorites;
CREATE POLICY "Users remove own favorites"
  ON public.favorites FOR DELETE
  USING (auth.uid() = user_id);

-- Extend existing subscriptions table (do not recreate)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE;

-- Required for upsert onConflict: user_id (table was empty at Phase 6)
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_id_key
  ON public.subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user
  ON public.subscriptions(user_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own subscription" ON public.subscriptions;
CREATE POLICY "Users view own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid()::text = user_id::text);

-- Auto-create free subscription on signup (user_id stored as text in existing schema)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan, status)
  VALUES (NEW.id::text, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Trigger-only: do not expose via PostgREST RPC
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role;