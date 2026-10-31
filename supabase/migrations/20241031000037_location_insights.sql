-- Google Business Profile performance insights cache
create table if not exists public.location_insights (
  id                  uuid        default gen_random_uuid() primary key,
  user_id             uuid        not null references auth.users on delete cascade,
  location_id         uuid        not null references public.google_locations on delete cascade,
  date                date        not null,
  impressions_maps    integer     not null default 0,
  impressions_search  integer     not null default 0,
  direction_requests  integer     not null default 0,
  call_clicks         integer     not null default 0,
  website_clicks      integer     not null default 0,
  synced_at           timestamptz not null default now(),
  constraint location_insights_loc_date_key unique (location_id, date)
);

alter table public.location_insights enable row level security;

create policy "users_own_insights" on public.location_insights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index location_insights_loc_date_idx
  on public.location_insights (location_id, date desc);
