-- Download history for workspace model packages (no relay).
create table if not exists public.user_downloads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  asset_name text not null,
  asset_source text not null check (asset_source in ('polyhaven', 'sketchfab')),
  asset_id text not null,
  download_url text not null,
  file_size text,
  file_size_bytes bigint,
  downloaded_at timestamptz not null default now()
);

create index if not exists user_downloads_user_id_downloaded_at_idx
  on public.user_downloads (user_id, downloaded_at desc);

alter table public.user_downloads enable row level security;

create policy "user_downloads_select_own"
  on public.user_downloads for select
  using (auth.uid() = user_id);

create policy "user_downloads_insert_own"
  on public.user_downloads for insert
  with check (auth.uid() = user_id);
