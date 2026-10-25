-- Review Request Campaigns
-- Tracks email (+ future SMS/WhatsApp) campaigns for soliciting Google reviews

create table if not exists public.campaigns (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations(id) on delete cascade,
  name                text not null,
  channel             text not null default 'email' check (channel in ('email','sms','whatsapp')),
  status              text not null default 'draft' check (status in ('draft','scheduled','sending','sent','paused','failed')),
  subject             text,
  body                text,
  from_name           text,
  reply_to            text,
  review_link         text,
  scheduled_at        timestamptz,
  sent_at             timestamptz,
  total_contacts      integer not null default 0,
  sent_count          integer not null default 0,
  opened_count        integer not null default 0,
  clicked_count       integer not null default 0,
  unsubscribed_count  integer not null default 0,
  created_by          uuid references auth.users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.campaign_contacts (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text,
  email       text,
  phone       text,
  status      text not null default 'pending' check (status in ('pending','sent','failed','bounced','unsubscribed')),
  sent_at     timestamptz,
  opened_at   timestamptz,
  clicked_at  timestamptz,
  error       text,
  created_at  timestamptz not null default now()
);

create table if not exists public.campaign_events (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  contact_id  uuid references public.campaign_contacts(id) on delete set null,
  event_type  text not null check (event_type in ('sent','opened','clicked','bounced','unsubscribed','failed')),
  meta        jsonb,
  created_at  timestamptz not null default now()
);

-- Indexes
create index if not exists campaigns_org_id_idx on public.campaigns(org_id);
create index if not exists campaign_contacts_campaign_id_idx on public.campaign_contacts(campaign_id);
create index if not exists campaign_events_campaign_id_idx on public.campaign_events(campaign_id);

-- RLS
alter table public.campaigns enable row level security;
alter table public.campaign_contacts enable row level security;
alter table public.campaign_events enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='campaigns' and policyname='org_members_manage_campaigns') then
    create policy org_members_manage_campaigns on public.campaigns
      using (org_id in (select org_id from public.org_members where user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='campaign_contacts' and policyname='org_members_manage_campaign_contacts') then
    create policy org_members_manage_campaign_contacts on public.campaign_contacts
      using (org_id in (select org_id from public.org_members where user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='campaign_events' and policyname='org_members_read_campaign_events') then
    create policy org_members_read_campaign_events on public.campaign_events
      for select using (
        campaign_id in (
          select id from public.campaigns
          where org_id in (select org_id from public.org_members where user_id = auth.uid())
        )
      );
  end if;
  if not exists (select 1 from pg_policies where tablename='campaigns' and policyname='platform_members_read_campaigns') then
    create policy platform_members_read_campaigns on public.campaigns
      for select using (
        exists (select 1 from public.platform_members where user_id = auth.uid())
      );
  end if;
end $$;

-- Atomic counter increment helper
create or replace function public.increment_campaign_counter(p_campaign_id uuid, p_field text)
returns void language plpgsql security definer as $$
begin
  if p_field = 'opened_count' then
    update public.campaigns set opened_count = opened_count + 1 where id = p_campaign_id;
  elsif p_field = 'clicked_count' then
    update public.campaigns set clicked_count = clicked_count + 1 where id = p_campaign_id;
  elsif p_field = 'unsubscribed_count' then
    update public.campaigns set unsubscribed_count = unsubscribed_count + 1 where id = p_campaign_id;
  end if;
end;
$$;
