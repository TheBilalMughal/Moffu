-- Migration: page_views — IP + path tracking per user, 90-day retention

create table if not exists public.page_views (
  id           uuid        default gen_random_uuid() primary key,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  ip           text        not null,
  path         text        not null,
  user_agent   text,
  created_at   timestamptz not null default now()
);

-- Fast lookups by user and time
create index if not exists page_views_user_id_created_at_idx
  on public.page_views (user_id, created_at desc);

-- Fast cleanup sweep
create index if not exists page_views_created_at_idx
  on public.page_views (created_at);

-- RLS: no direct client access — service role only
alter table public.page_views enable row level security;

-- Admins (platform_members) can read all rows
create policy "platform_members can read page_views"
  on public.page_views for select
  using (
    exists (
      select 1 from public.platform_members pm
      where pm.user_id = auth.uid()
    )
  );

-- No direct insert/update/delete from client — edge function uses service role
comment on table public.page_views is
  'Portal page-view events. Retention: 90 days. Inserted by track-pageview edge function (service role).';

-- pg_cron: delete rows older than 90 days (runs daily at 02:00 UTC)
-- Requires pg_cron extension (enabled in Supabase by default on paid plans).
-- If not available, a scheduled edge function handles cleanup instead.
select cron.schedule(
  'page_views_cleanup',
  '0 2 * * *',
  $$delete from public.page_views where created_at < now() - interval '90 days'$$
) where exists (
  select 1 from pg_extension where extname = 'pg_cron'
);
