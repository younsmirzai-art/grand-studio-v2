-- Streamed downloads no longer store a Supabase file URL.
alter table public.user_downloads alter column download_url drop not null;
