-- Review Gating / Feedback Funnel
-- feedback_requests: one row per link sent to a customer
-- feedback_responses: one row per customer response (happy or unhappy)

create table if not exists public.feedback_requests (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  location_id      uuid references public.google_locations(id) on delete set null,
  campaign_id      uuid references public.campaigns(id) on delete set null,
  token            text not null unique default encode(gen_random_bytes(18), 'base64url'),
  customer_name    text,
  customer_email   text,
  customer_phone   text,
  channel          text not null default 'manual' check (channel in ('email','sms','manual')),
  google_review_url text,
  status           text not null default 'pending' check (status in ('pending','responded','expired')),
  expires_at       timestamptz not null default (now() + interval '30 days'),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.feedback_responses (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references public.feedback_requests(id) on delete cascade,
  org_id        uuid not null references public.organizations(id) on delete cascade,
  location_id   uuid references public.google_locations(id) on delete set null,
  sentiment     text not null check (sentiment in ('happy','unhappy')),
  rating_choice integer check (rating_choice between 1 and 5),
  feedback_text text,
  resolved      boolean not null default false,
  resolved_at   timestamptz,
  resolved_by   uuid references auth.users(id),
  responded_at  timestamptz not null default now()
);

-- indexes
create index if not exists feedback_requests_org_id_idx      on public.feedback_requests(org_id);
create index if not exists feedback_requests_location_id_idx on public.feedback_requests(location_id);
create index if not exists feedback_requests_token_idx       on public.feedback_requests(token);
create index if not exists feedback_responses_org_id_idx     on public.feedback_responses(org_id);
create index if not exists feedback_responses_request_id_idx on public.feedback_responses(request_id);
create index if not exists feedback_responses_location_id_idx on public.feedback_responses(location_id);

-- auto-update updated_at
create or replace function public.set_feedback_request_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists feedback_requests_updated_at on public.feedback_requests;
create trigger feedback_requests_updated_at
  before update on public.feedback_requests
  for each row execute function public.set_feedback_request_updated_at();

-- RLS
alter table public.feedback_requests  enable row level security;
alter table public.feedback_responses enable row level security;

do $$ begin
  -- feedback_requests: org members can manage their own
  if not exists (select 1 from pg_policies where tablename='feedback_requests' and policyname='org_members_manage_feedback_requests') then
    create policy org_members_manage_feedback_requests on public.feedback_requests
      using (org_id in (select org_id from public.org_members where user_id = auth.uid()));
  end if;

  -- feedback_responses: org members can read/update their org's responses
  if not exists (select 1 from pg_policies where tablename='feedback_responses' and policyname='org_members_manage_feedback_responses') then
    create policy org_members_manage_feedback_responses on public.feedback_responses
      using (org_id in (select org_id from public.org_members where user_id = auth.uid()));
  end if;

  -- platform_members (admins) can read everything
  if not exists (select 1 from pg_policies where tablename='feedback_requests' and policyname='platform_members_read_feedback_requests') then
    create policy platform_members_read_feedback_requests on public.feedback_requests
      for select using (exists (select 1 from public.platform_members where user_id = auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where tablename='feedback_responses' and policyname='platform_members_read_feedback_responses') then
    create policy platform_members_read_feedback_responses on public.feedback_responses
      for select using (exists (select 1 from public.platform_members where user_id = auth.uid()));
  end if;
end $$;
