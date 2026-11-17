-- GeoRank storage is user-owned because existing GBP locations are user-scoped.
-- Only the authenticated Edge Function service may write scan data; customers read
-- through the authenticated API after provider and data-rights gates are enabled.

create table if not exists public.georank_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  location_id uuid not null references public.google_locations(id) on delete cascade,
  idempotency_key text not null,
  keyword text not null check (length(btrim(keyword)) between 1 and 120),
  provider text not null check (provider in ('dataforseo')),
  search_surface text not null default 'google_maps' check (search_surface = 'google_maps'),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  language_code text not null check (language_code ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  device text not null check (device in ('desktop', 'mobile')),
  center_latitude double precision not null check (center_latitude between -90 and 90),
  center_longitude double precision not null check (center_longitude between -180 and 180),
  center_source text not null check (center_source in ('merchant_provided', 'location_record')),
  grid_size smallint not null check (grid_size between 1 and 15 and grid_size % 2 = 1),
  spacing_meters integer not null check (spacing_meters between 100 and 30000),
  result_depth smallint not null check (result_depth between 1 and 700),
  methodology_version text not null,
  config_hash text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'partial', 'failed', 'cancelled')),
  planned_points integer not null check (planned_points between 1 and 225),
  estimated_cost_usd numeric(12,6) not null check (estimated_cost_usd >= 0),
  actual_cost_usd numeric(12,6) check (actual_cost_usd is null or actual_cost_usd >= 0),
  provider_reference text,
  error_code text,
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  unique (id, user_id)
);

create table if not exists public.georank_points (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  point_index smallint not null check (point_index between 0 and 224),
  grid_row smallint not null check (grid_row between 0 and 14),
  grid_column smallint not null check (grid_column between 0 and 14),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  status text not null default 'pending' check (status in ('found', 'not_found_within_depth', 'failed', 'pending', 'cancelled')),
  rank smallint check (rank is null or rank between 1 and 700),
  observed_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (scan_id, user_id) references public.georank_scans(id, user_id) on delete cascade,
  unique (scan_id, point_index),
  check ((status = 'found' and rank is not null) or (status <> 'found' and rank is null))
);

create table if not exists public.georank_usage_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  period_start timestamptz not null,
  estimated_cost_usd numeric(12,6) not null check (estimated_cost_usd >= 0),
  actual_cost_usd numeric(12,6) check (actual_cost_usd is null or actual_cost_usd >= 0),
  status text not null default 'reserved' check (status in ('reserved', 'settled', 'released')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists georank_scans_location_created_idx
  on public.georank_scans (user_id, location_id, created_at desc);
create index if not exists georank_scans_expiry_idx
  on public.georank_scans (expires_at) where status in ('completed', 'partial', 'failed', 'cancelled');
create index if not exists georank_points_scan_status_idx
  on public.georank_points (scan_id, status);
create index if not exists georank_points_expiry_idx on public.georank_points (expires_at);
create index if not exists georank_reservations_period_idx
  on public.georank_usage_reservations (user_id, period_start, status);

alter table public.georank_scans enable row level security;
alter table public.georank_points enable row level security;
alter table public.georank_usage_reservations enable row level security;

create policy georank_scans_owner_read on public.georank_scans
  for select to authenticated using ((select auth.uid()) = user_id);
create policy georank_points_owner_read on public.georank_points
  for select to authenticated using ((select auth.uid()) = user_id);
create policy georank_reservations_owner_read on public.georank_usage_reservations
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.georank_scans, public.georank_points, public.georank_usage_reservations from anon, authenticated;
grant select on public.georank_scans, public.georank_points, public.georank_usage_reservations to authenticated;
grant all on public.georank_scans, public.georank_points, public.georank_usage_reservations to service_role;

create or replace function public.reserve_georank_usage(
  p_user_id uuid,
  p_idempotency_key text,
  p_period_start timestamptz,
  p_estimated_cost_usd numeric,
  p_budget_limit_usd numeric
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation_id uuid;
  v_reserved numeric(12,6);
begin
  if p_user_id is null or p_idempotency_key is null or length(p_idempotency_key) < 8
     or p_period_start is null or p_estimated_cost_usd is null or p_estimated_cost_usd <= 0
     or p_budget_limit_usd is null or p_budget_limit_usd < 0 then
    raise exception 'INVALID_RESERVATION_INPUT' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));

  select r.id into v_reservation_id
  from public.georank_usage_reservations r
  where r.user_id = p_user_id and r.idempotency_key = p_idempotency_key;
  if v_reservation_id is not null then
    return v_reservation_id;
  end if;

  select coalesce(sum(case when r.status = 'settled' then r.actual_cost_usd else r.estimated_cost_usd end), 0)
    into v_reserved
  from public.georank_usage_reservations r
  where r.user_id = p_user_id and r.period_start = p_period_start and r.status in ('reserved', 'settled');

  if v_reserved + p_estimated_cost_usd > p_budget_limit_usd then
    raise exception 'GEORANK_BUDGET_EXCEEDED' using errcode = 'P0001';
  end if;

  insert into public.georank_usage_reservations (user_id, idempotency_key, period_start, estimated_cost_usd)
  values (p_user_id, p_idempotency_key, p_period_start, p_estimated_cost_usd)
  returning id into v_reservation_id;

  return v_reservation_id;
end;
$$;

revoke all on function public.reserve_georank_usage(uuid, text, timestamptz, numeric, numeric) from public, anon, authenticated;
grant execute on function public.reserve_georank_usage(uuid, text, timestamptz, numeric, numeric) to service_role;

create or replace function public.cleanup_expired_georank_data()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted bigint;
begin
  delete from public.georank_scans where expires_at <= now();
  get diagnostics v_deleted = row_count;
  delete from public.georank_usage_reservations
    where period_start < now() - interval '13 months' and status in ('settled', 'released');
  return v_deleted;
end;
$$;
revoke all on function public.cleanup_expired_georank_data() from public, anon, authenticated;

select cron.schedule(
  'georank_expired_data_cleanup',
  '15 * * * *',
  'select public.cleanup_expired_georank_data()'
) where exists (select 1 from pg_extension where extname = 'pg_cron');
