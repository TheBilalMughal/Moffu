-- Enforce package entitlements at the database boundary and reserve metered
-- usage atomically so parallel Edge Function requests cannot pass the same cap.

create or replace function public.assert_org_feature(
  p_org_id uuid,
  p_feature_key text,
  p_quota_key text,
  p_used bigint default 0
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan_id uuid;
  v_feature_exists boolean := false;
  v_feature_enabled boolean;
  v_quota_exists boolean := false;
  v_value_type text;
  v_limit bigint;
  v_override bigint;
begin
  select s.plan_id into v_plan_id
  from public.org_members om
  join public.subscriptions s on s.user_id = om.user_id
  where om.org_id = p_org_id
    and om.role::text = 'owner'
    and om.status::text = 'active'
    and s.status in ('active', 'trialing')
  order by s.created_at desc
  limit 1;

  if v_plan_id is null then
    raise exception 'ACTIVE_SUBSCRIPTION_REQUIRED' using errcode = 'P0001';
  end if;

  select true, pe.bool_value into v_feature_exists, v_feature_enabled
  from public.plan_entitlements pe
  where pe.plan_id = v_plan_id and pe.key = p_feature_key;

  if v_feature_exists and v_feature_enabled is false then
    raise exception 'FEATURE_NOT_INCLUDED:%', p_feature_key using errcode = 'P0001';
  end if;

  select true, pe.value_type, pe.limit_value
    into v_quota_exists, v_value_type, v_limit
  from public.plan_entitlements pe
  where pe.plan_id = v_plan_id and pe.key = p_quota_key;

  if v_quota_exists is not true then
    raise exception 'ENTITLEMENT_NOT_CONFIGURED:%', p_quota_key using errcode = 'P0001';
  end if;
  if p_quota_key = 'campaign_emails' then
    select opo.campaign_emails_per_month::bigint into v_override
    from public.org_members om
    join public.org_plan_overrides opo on opo.org_id = om.org_id
    where om.org_id = p_org_id and om.role::text = 'owner'
      and (opo.contract_start is null or opo.contract_start <= current_date)
      and (opo.contract_end is null or opo.contract_end >= current_date)
    limit 1;
    if v_override = -1 then return; end if;
    if v_override is not null then
      v_value_type := 'LIMIT';
      v_limit := v_override;
    end if;
  end if;
  if v_value_type = 'UNLIMITED' then
    return;
  end if;
  if coalesce(p_used, 0) >= coalesce(v_limit, 0) then
    raise exception 'PACKAGE_LIMIT_REACHED:%', p_quota_key using errcode = 'P0001';
  end if;
end;
$$;

create table if not exists public.plan_usage_meter_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  quota_key text not null check (quota_key in ('marketing_posts', 'feedback_requests')),
  resource_id uuid not null,
  created_at timestamptz not null default now(),
  unique (quota_key, resource_id)
);
alter table public.plan_usage_meter_events enable row level security;
revoke all on public.plan_usage_meter_events from anon, authenticated;
grant all on public.plan_usage_meter_events to service_role;

-- Preserve already consumed quota in this billing month before switching to
-- append-only meters (deleting a post/request must not restore its allowance).
insert into public.plan_usage_meter_events (org_id, quota_key, resource_id, created_at)
select mp.org_id, 'marketing_posts', mp.id, mp.created_at
from public.marketing_posts mp
where mp.created_at >= date_trunc('month', now())
on conflict (quota_key, resource_id) do nothing;
insert into public.plan_usage_meter_events (org_id, quota_key, resource_id, created_at)
select fr.org_id, 'feedback_requests', fr.id, fr.created_at
from public.feedback_requests fr
where fr.created_at >= date_trunc('month', now())
on conflict (quota_key, resource_id) do nothing;

create or replace function public.enforce_marketing_post_entitlement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_used bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.org_id::text || ':marketing_posts', 0)
  );
  new.created_at := now();
  select count(*) into v_used
  from public.plan_usage_meter_events e
  where e.org_id = new.org_id and e.quota_key = 'marketing_posts'
    and e.created_at >= date_trunc('month', now());
  perform public.assert_org_feature(new.org_id, 'feature_marketing', 'marketing_posts', v_used);
  insert into public.plan_usage_meter_events (org_id, quota_key, resource_id)
  values (new.org_id, 'marketing_posts', new.id);
  return new;
end;
$$;

drop trigger if exists enforce_marketing_post_entitlement on public.marketing_posts;
create trigger enforce_marketing_post_entitlement
before insert on public.marketing_posts
for each row execute function public.enforce_marketing_post_entitlement();

create or replace function public.enforce_feedback_request_entitlement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_used bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.org_id::text || ':feedback_requests', 0)
  );
  new.created_at := now();
  select count(*) into v_used
  from public.plan_usage_meter_events e
  where e.org_id = new.org_id and e.quota_key = 'feedback_requests'
    and e.created_at >= date_trunc('month', now());
  perform public.assert_org_feature(new.org_id, 'feature_feedback', 'feedback_requests', v_used);
  insert into public.plan_usage_meter_events (org_id, quota_key, resource_id)
  values (new.org_id, 'feedback_requests', new.id);
  return new;
end;
$$;

drop trigger if exists enforce_feedback_request_entitlement on public.feedback_requests;
create trigger enforce_feedback_request_entitlement
before insert on public.feedback_requests
for each row execute function public.enforce_feedback_request_entitlement();

create or replace function public.enforce_campaign_feature()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quota_key text;
begin
  v_quota_key := case new.channel
    when 'sms' then 'campaign_sms'
    when 'whatsapp' then 'campaign_whatsapp'
    else 'campaign_emails'
  end;
  perform public.assert_org_feature(new.org_id, 'feature_campaigns', v_quota_key, 0);
  return new;
end;
$$;

drop trigger if exists enforce_campaign_feature on public.campaigns;
create trigger enforce_campaign_feature
before insert on public.campaigns
for each row execute function public.enforce_campaign_feature();

create or replace function public.enforce_selected_location_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan_id uuid;
  v_limit bigint;
  v_value_type text;
  v_feature_enabled boolean;
  v_override integer;
  v_selected bigint;
begin
  if new.is_selected is not true or (tg_op = 'UPDATE' and old.is_selected is true) then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text || ':locations', 0)
  );

  select s.plan_id into v_plan_id
  from public.subscriptions s
  where s.user_id = new.user_id and s.status in ('active', 'trialing')
  order by s.created_at desc
  limit 1;
  if v_plan_id is null then
    raise exception 'ACTIVE_SUBSCRIPTION_REQUIRED' using errcode = 'P0001';
  end if;

  select pe.bool_value into v_feature_enabled from public.plan_entitlements pe
  where pe.plan_id = v_plan_id and pe.key = 'feature_google_profile';
  if v_feature_enabled is false then
    raise exception 'FEATURE_NOT_INCLUDED:feature_google_profile' using errcode = 'P0001';
  end if;

  select pe.value_type, pe.limit_value into v_value_type, v_limit
  from public.plan_entitlements pe
  where pe.plan_id = v_plan_id and pe.key = 'locations';
  if v_value_type is null then
    raise exception 'ENTITLEMENT_NOT_CONFIGURED:locations' using errcode = 'P0001';
  end if;

  select opo.max_locations into v_override
  from public.org_members om
  join public.org_plan_overrides opo on opo.org_id = om.org_id
  where om.user_id = new.user_id and om.role::text = 'owner'
    and (opo.contract_end is null or opo.contract_end >= current_date)
  limit 1;
  if v_override = -1 or v_value_type = 'UNLIMITED' then
    return new;
  end if;
  if v_override is not null then v_limit := v_override; end if;

  select count(*) into v_selected
  from public.google_locations gl
  where gl.user_id = new.user_id
    and gl.is_selected is true
    and (tg_op <> 'UPDATE' or gl.id <> new.id);

  if v_selected >= coalesce(v_limit, 0) then
    raise exception 'PACKAGE_LIMIT_REACHED:locations' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_selected_location_limit on public.google_locations;
create trigger enforce_selected_location_limit
before insert or update of is_selected on public.google_locations
for each row execute function public.enforce_selected_location_limit();

create or replace function public.enforce_team_member_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_plan_id uuid;
  v_limit bigint;
  v_value_type text;
  v_feature_enabled boolean;
  v_override integer;
  v_current bigint;
begin
  if new.status::text <> 'active' or new.role::text = 'owner' then return new; end if;
  if tg_op = 'UPDATE' and old.status::text = 'active' then return new; end if;
  if exists (select 1 from public.platform_members pm where pm.user_id = new.user_id and pm.is_active = true) then return new; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.org_id::text || ':team_members', 0)
  );
  select om.user_id into v_owner_id from public.org_members om
  where om.org_id = new.org_id and om.role::text = 'owner' and om.status::text = 'active'
  limit 1;
  select s.plan_id into v_plan_id from public.subscriptions s
  where s.user_id = v_owner_id and s.status in ('active', 'trialing')
  order by s.created_at desc limit 1;
  if v_plan_id is null then
    raise exception 'ACTIVE_SUBSCRIPTION_REQUIRED' using errcode = 'P0001';
  end if;
  select pe.bool_value into v_feature_enabled from public.plan_entitlements pe
  where pe.plan_id = v_plan_id and pe.key = 'feature_team';
  if v_feature_enabled is false then
    raise exception 'FEATURE_NOT_INCLUDED:feature_team' using errcode = 'P0001';
  end if;
  select pe.value_type, pe.limit_value into v_value_type, v_limit
  from public.plan_entitlements pe where pe.plan_id = v_plan_id and pe.key = 'team_members';
  select opo.max_team_members into v_override from public.org_plan_overrides opo
  where opo.org_id = new.org_id and (opo.contract_end is null or opo.contract_end >= current_date)
  limit 1;
  if v_override = -1 or v_value_type = 'UNLIMITED' then return new; end if;
  if v_override is not null then v_limit := v_override; end if;
  if v_limit is null then v_limit := 1; end if;

  select (
    (select count(*) from public.org_members om
      where om.org_id = new.org_id and om.status::text = 'active'
        and not exists (select 1 from public.platform_members pm where pm.user_id = om.user_id and pm.is_active = true))
    +
    (select count(*) from public.invitations i
      where i.org_id = new.org_id and i.accepted_at is null and i.revoked_at is null and i.expires_at > now())
  ) into v_current;
  if v_current > v_limit then
    raise exception 'Team seat limit reached for your plan' using errcode = 'P0006';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_team_member_limit on public.org_members;
create trigger enforce_team_member_limit
before insert or update of status, role on public.org_members
for each row execute function public.enforce_team_member_limit();

create table if not exists public.campaign_email_reservations (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  reserved_count integer not null check (reserved_count >= 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.campaign_email_reservations enable row level security;
revoke all on public.campaign_email_reservations from anon, authenticated;
grant all on public.campaign_email_reservations to service_role;

create or replace function public.reserve_campaign_email_quota(
  p_org_id uuid,
  p_campaign_id uuid,
  p_requested integer
) returns table(allowed boolean, used bigint, limit_value bigint, reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan_id uuid;
  v_owner_id uuid;
  v_value_type text;
  v_limit bigint;
  v_feature_enabled boolean;
  v_feature_exists boolean := false;
  v_override bigint;
  v_reserved bigint;
  v_sent bigint;
  v_active_reservation uuid;
begin
  if p_requested is null or p_requested < 0 then
    raise exception 'INVALID_CAMPAIGN_QUOTA_INPUT' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_org_id::text || ':campaign_emails:' || date_trunc('month', now())::date::text, 0)
  );
  select r.campaign_id into v_active_reservation
  from public.campaign_email_reservations r
  where r.campaign_id = p_campaign_id and r.expires_at > now()
  limit 1;
  if v_active_reservation is not null then
    return query select false, 0::bigint, 0::bigint, 'This campaign is already being sent.'::text;
    return;
  end if;

  select om.user_id into v_owner_id from public.org_members om
  where om.org_id = p_org_id and om.role::text = 'owner' and om.status::text = 'active'
  limit 1;
  select s.plan_id into v_plan_id from public.subscriptions s
  where s.user_id = v_owner_id and s.status in ('active', 'trialing')
  order by s.created_at desc limit 1;
  if v_plan_id is null then
    return query select false, 0::bigint, 0::bigint, 'An active subscription is required to send campaigns.'::text;
    return;
  end if;

  select true, pe.bool_value into v_feature_exists, v_feature_enabled
  from public.plan_entitlements pe where pe.plan_id = v_plan_id and pe.key = 'feature_campaigns';
  if v_feature_exists and v_feature_enabled is false then
    return query select false, 0::bigint, 0::bigint, 'Campaigns are not included in your current plan.'::text;
    return;
  end if;
  select pe.value_type, pe.limit_value into v_value_type, v_limit
  from public.plan_entitlements pe
  where pe.plan_id = v_plan_id and pe.key = 'campaign_emails';
  select opo.campaign_emails_per_month::bigint into v_override
  from public.org_plan_overrides opo
  where opo.org_id = p_org_id
    and (opo.contract_start is null or opo.contract_start <= current_date)
    and (opo.contract_end is null or opo.contract_end >= current_date)
  limit 1;
  if v_override = -1 then v_value_type := 'UNLIMITED'; end if;
  if v_override is not null and v_override <> -1 then
    v_value_type := 'LIMIT';
    v_limit := v_override;
  end if;

  select count(*) into v_sent
  from public.campaign_events ce
  join public.campaigns c on c.id = ce.campaign_id
  where c.org_id = p_org_id and ce.event_type = 'sent'
    and ce.created_at >= date_trunc('month', now())
    and not exists (
      select 1 from public.campaign_email_reservations r
      where r.campaign_id = c.id and r.expires_at > now()
    );
  select coalesce(sum(r.reserved_count), 0) into v_reserved
  from public.campaign_email_reservations r
  where r.org_id = p_org_id and r.expires_at > now()
    and r.created_at >= date_trunc('month', now());

  if v_value_type = 'UNLIMITED' then
    v_limit := null;
  elsif v_limit is null then
    v_limit := 0;
  end if;
  if v_limit is not null and v_sent + v_reserved + p_requested > v_limit then
    return query select false, v_sent + v_reserved, v_limit,
      format('This campaign exceeds the monthly email limit (%s used, %s limit).', v_sent + v_reserved, v_limit);
    return;
  end if;

  insert into public.campaign_email_reservations(campaign_id, org_id, reserved_count, expires_at)
  values (p_campaign_id, p_org_id, p_requested, now() + interval '24 hours')
  on conflict (campaign_id) do update
    set org_id = excluded.org_id, reserved_count = excluded.reserved_count,
        expires_at = excluded.expires_at, created_at = now();
  return query select true, v_sent + v_reserved, v_limit, null::text;
end;
$$;

create or replace function public.release_campaign_email_quota(p_campaign_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.campaign_email_reservations set expires_at = now()
  where campaign_id = p_campaign_id;
$$;

revoke all on function public.reserve_campaign_email_quota(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.release_campaign_email_quota(uuid) from public, anon, authenticated;
grant execute on function public.reserve_campaign_email_quota(uuid, uuid, integer) to service_role;
grant execute on function public.release_campaign_email_quota(uuid) to service_role;

create or replace function public.create_invitation(
  p_org_id uuid,
  p_email text,
  p_role text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_plan_id uuid;
  v_limit bigint;
  v_value_type text;
  v_feature_enabled boolean;
  v_override integer;
  v_current bigint;
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.org_members
    where org_id = p_org_id and user_id = auth.uid()
      and status = 'active' and role in ('owner', 'admin')
  ) then
    raise exception 'Not authorized' using errcode = 'P0002';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_org_id::text || ':team_members', 0)
  );

  select om.user_id into v_owner_id
  from public.org_members om
  where om.org_id = p_org_id and om.role::text = 'owner' and om.status::text = 'active'
  limit 1;
  select s.plan_id into v_plan_id
  from public.subscriptions s
  where s.user_id = v_owner_id and s.status in ('active', 'trialing')
  order by s.created_at desc
  limit 1;
  if v_plan_id is null then
    raise exception 'ACTIVE_SUBSCRIPTION_REQUIRED' using errcode = 'P0001';
  end if;

  select pe.bool_value into v_feature_enabled
  from public.plan_entitlements pe
  where pe.plan_id = v_plan_id and pe.key = 'feature_team';
  if v_feature_enabled is false then
    raise exception 'FEATURE_NOT_INCLUDED:feature_team' using errcode = 'P0001';
  end if;

  select pe.value_type, pe.limit_value into v_value_type, v_limit
  from public.plan_entitlements pe
  where pe.plan_id = v_plan_id and pe.key = 'team_members';
  select opo.max_team_members into v_override
  from public.org_plan_overrides opo
  where opo.org_id = p_org_id and (opo.contract_end is null or opo.contract_end >= current_date)
  limit 1;

  select (
    (select count(*) from public.org_members om
      where om.org_id = p_org_id and om.status::text = 'active'
        and not exists (select 1 from public.platform_members pm where pm.user_id = om.user_id and pm.is_active = true))
    +
    (select count(*) from public.invitations i
      where i.org_id = p_org_id and i.accepted_at is null and i.revoked_at is null
        and i.expires_at > now() and lower(i.email) <> lower(p_email))
  ) into v_current;

  if v_override = -1 or v_value_type = 'UNLIMITED' then
    v_limit := null;
  elsif v_override is not null then
    v_limit := v_override;
  elsif v_limit is null then
    v_limit := 1;
  end if;

  if v_limit is not null and v_current >= v_limit then
    raise exception 'Team seat limit reached for your plan' using errcode = 'P0006';
  end if;

  update public.invitations set revoked_at = now()
  where org_id = p_org_id and email = lower(p_email)
    and accepted_at is null and revoked_at is null;
  insert into public.invitations (org_id, invited_by, email, role)
  values (p_org_id, auth.uid(), lower(p_email), p_role::public.member_role)
  returning token into v_token;
  return v_token;
end;
$$;

create or replace function public.reserve_plan_usage(
  p_user_id uuid,
  p_event_type text,
  p_review_id uuid default null
) returns table(allowed boolean, used bigint, limit_value bigint, org_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan_id uuid;
  v_org_id uuid;
  v_ent_key text;
  v_override bigint;
  v_limit bigint;
  v_value_type text;
  v_reset text;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_used bigint;
begin
  if p_user_id is null or p_event_type not in ('ai_draft', 'published_reply') then
    raise exception 'INVALID_USAGE_RESERVATION' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || ':' || p_event_type, 0)
  );

  v_ent_key := case p_event_type when 'ai_draft' then 'ai_drafts' else 'published_replies' end;
  select om.org_id into v_org_id
  from public.org_members om
  where om.user_id = p_user_id and om.status::text = 'active'
  order by (om.role::text = 'owner') desc
  limit 1;
  select s.plan_id, s.current_period_start, s.current_period_end
    into v_plan_id, v_period_start, v_period_end
  from public.subscriptions s
  where s.user_id = p_user_id and s.status in ('active', 'trialing')
  order by s.created_at desc
  limit 1;
  if v_plan_id is null then
    return query select false, 0::bigint, 0::bigint, v_org_id;
    return;
  end if;

  if v_org_id is not null then
    select case p_event_type
      when 'ai_draft' then opo.ai_drafts_per_month::bigint
      else opo.published_replies_per_month::bigint
    end into v_override
    from public.org_plan_overrides opo
    where opo.org_id = v_org_id
      and (opo.contract_start is null or opo.contract_start <= current_date)
      and (opo.contract_end is null or opo.contract_end >= current_date)
    limit 1;
  end if;

  if v_override = -1 then
    v_limit := null;
    v_period_start := '-infinity'::timestamptz;
    v_period_end := 'infinity'::timestamptz;
  elsif v_override is not null then
    v_limit := v_override;
    v_period_start := date_trunc('month', now());
    v_period_end := date_trunc('month', now()) + interval '1 month';
  else
    select pe.value_type, pe.limit_value, coalesce(pe.usage_reset, 'monthly')
      into v_value_type, v_limit, v_reset
    from public.plan_entitlements pe
    where pe.plan_id = v_plan_id and pe.key = v_ent_key;
    if not found or v_value_type = 'UNLIMITED' then
      v_limit := null;
      v_period_start := '-infinity'::timestamptz;
      v_period_end := 'infinity'::timestamptz;
    elsif v_reset = 'weekly' then
      v_period_start := now() - interval '7 days';
      v_period_end := now();
    end if;
  end if;

  select count(*) into v_used
  from public.usage_events ue
  where ue.user_id = p_user_id and ue.event_type = p_event_type
    and ue.created_at >= v_period_start and ue.created_at < v_period_end;

  if v_limit is not null and v_used >= v_limit then
    return query select false, v_used, v_limit, v_org_id;
    return;
  end if;

  insert into public.usage_events(user_id, event_type, review_id)
  values (p_user_id, p_event_type, p_review_id);
  return query select true, v_used + 1, v_limit, v_org_id;
end;
$$;

revoke all on function public.assert_org_feature(uuid, text, text, bigint) from public, anon, authenticated;
revoke all on function public.reserve_plan_usage(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.reserve_plan_usage(uuid, text, uuid) to service_role;
