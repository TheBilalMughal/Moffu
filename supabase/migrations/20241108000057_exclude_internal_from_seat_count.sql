-- Migration: 057 — Exclude internal (platform) members from seat counts and team lists
--
-- Bug: platform_members who join a customer org for support purposes were being
-- counted against the customer's Free-plan seat limit and appearing in their team list.
-- Fix: filter out any user present in public.platform_members from seat counts and
-- the get_team_members RPC used by the customer-facing Team page.

-- ── get_team_members: exclude internal staff ───────────────────────────────────
create or replace function public.get_team_members(p_org_id uuid)
  returns table (
    member_id    uuid,
    user_id      uuid,
    display_name text,
    email        text,
    role         text,
    status       text,
    joined_at    timestamptz
  )
  language sql
  security definer
  stable
  set search_path = public
as $$
  select
    om.id            as member_id,
    om.user_id,
    p.display_name,
    u.email,
    om.role::text,
    om.status::text,
    om.joined_at
  from   public.org_members om
  join   public.profiles    p  on p.id = om.user_id
  join   auth.users         u  on u.id = om.user_id
  where  om.org_id = p_org_id
    and  public.is_org_member(p_org_id)
    -- exclude internal Moffu staff
    and  not exists (
           select 1 from public.platform_members pm
           where  pm.user_id   = om.user_id
             and  pm.is_active = true
         )
  order by om.joined_at asc nulls last;
$$;

-- ── create_invitation: exclude internal staff from seat count ─────────────────
create or replace function public.create_invitation(
  p_org_id uuid,
  p_email  text,
  p_role   text
) returns text
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_plan_id  uuid;
  v_limit    bigint;
  v_current  bigint;
  v_token    text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.org_members
     where org_id  = p_org_id
       and user_id = auth.uid()
       and status  = 'active'
       and role   in ('owner', 'admin')
  ) then
    raise exception 'Not authorized' using errcode = 'P0002';
  end if;

  -- Seat limit check
  select s.plan_id into v_plan_id
  from   public.subscriptions s
  where  s.user_id = auth.uid()
    and  s.status  = 'active'
  limit 1;

  if v_plan_id is not null then
    select pe.limit_value into v_limit
    from   public.plan_entitlements pe
    where  pe.plan_id = v_plan_id
      and  pe.key     = 'team_members';

    if v_limit is not null then
      select (
        -- active members, excluding internal Moffu staff
        (select count(*)
         from   public.org_members om
         where  om.org_id = p_org_id
           and  om.status = 'active'
           and  not exists (
                  select 1 from public.platform_members pm
                  where  pm.user_id   = om.user_id
                    and  pm.is_active = true
                ))
        +
        -- pending invitations (internal staff cannot receive customer invites, so no exclusion needed)
        (select count(*)
         from   public.invitations
         where  org_id      = p_org_id
           and  accepted_at is null
           and  revoked_at  is null
           and  expires_at  > now())
      ) into v_current;

      if v_current >= v_limit then
        raise exception 'Team seat limit reached for your plan' using errcode = 'P0006';
      end if;
    end if;
  end if;

  -- Revoke any existing pending invite for this email in this org
  update public.invitations
     set revoked_at = now()
   where org_id      = p_org_id
     and email       = lower(p_email)
     and accepted_at is null
     and revoked_at  is null;

  -- Insert new invitation
  insert into public.invitations (org_id, invited_by, email, role)
  values (p_org_id, auth.uid(), lower(p_email), p_role::public.member_role)
  returning token into v_token;

  return v_token;
end;
$$;

-- ── get_seat_usage: returns {used, limit} excluding internal staff ─────────────
-- Called by the portal client to display seat usage on the Team page and billing page.
-- Uses security definer so it can read platform_members (RLS-restricted from clients).
create or replace function public.get_seat_usage(p_org_id uuid)
  returns json
  language plpgsql
  security definer
  stable
  set search_path = public
as $$
declare
  v_plan_id    uuid;
  v_limit      bigint;
  v_used       bigint;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'P0002';
  end if;

  -- Caller must be an active member of the org
  if not public.is_org_member(p_org_id) then
    raise exception 'Not authorized' using errcode = 'P0002';
  end if;

  -- Active non-internal members
  select count(*)
  into   v_used
  from   public.org_members om
  where  om.org_id = p_org_id
    and  om.status = 'active'
    and  not exists (
           select 1 from public.platform_members pm
           where  pm.user_id   = om.user_id
             and  pm.is_active = true
         );

  -- Add pending invitations to used count
  select v_used + count(*)
  into   v_used
  from   public.invitations
  where  org_id      = p_org_id
    and  accepted_at is null
    and  revoked_at  is null
    and  expires_at  > now();

  -- Look up plan limit
  select s.plan_id into v_plan_id
  from   public.subscriptions s
  where  s.user_id = auth.uid()
    and  s.status  = 'active'
  limit 1;

  if v_plan_id is null then
    return json_build_object('used', v_used, 'limit', null);
  end if;

  select pe.limit_value into v_limit
  from   public.plan_entitlements pe
  where  pe.plan_id = v_plan_id
    and  pe.key     = 'team_members';

  return json_build_object('used', v_used, 'limit', v_limit);
end;
$$;

grant execute on function public.get_seat_usage(uuid) to authenticated;
