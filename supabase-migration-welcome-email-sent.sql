CREATE TABLE IF NOT EXISTS public.welcome_email_sent (
  user_id text PRIMARY KEY,
  sent_at timestamptz DEFAULT now()
);
ALTER TABLE public.welcome_email_sent DISABLE ROW LEVEL SECURITY;
