-- Epic Games OAuth: link Epic account IDs to Supabase auth users
CREATE TABLE IF NOT EXISTS public.epic_accounts (
  epic_account_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Only backend (service role) should read/write; no RLS policies for app users
ALTER TABLE public.epic_accounts ENABLE ROW LEVEL SECURITY;

-- Deny all for anon and authenticated; service role bypasses RLS
CREATE POLICY "Service role only" ON public.epic_accounts
  FOR ALL USING (false);

COMMENT ON TABLE public.epic_accounts IS 'Maps Epic Games OAuth account_id to Supabase auth user for Sign in with Epic Games';
