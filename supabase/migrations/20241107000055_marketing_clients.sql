-- Migration: 055 — Marketing clients (homepage brand showcase)
create table if not exists public.marketing_clients (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  client_type text,
  logo_url    text,
  sort_order  int         not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.marketing_clients enable row level security;

-- Public read (web homepage fetches this)
create policy "marketing clients public read"
  on public.marketing_clients for select
  to public
  using (true);

-- Authenticated write (admin portal only)
create policy "marketing clients admin insert"
  on public.marketing_clients for insert
  to authenticated
  with check (true);

create policy "marketing clients admin update"
  on public.marketing_clients for update
  to authenticated
  using (true);

create policy "marketing clients admin delete"
  on public.marketing_clients for delete
  to authenticated
  using (true);
