-- Migration: 010 — Team management RPCs
-- Purpose: Invite members, accept invitations, manage roles and seats.
-- All mutating operations use security definer to bypass RLS.

-- ── get_team_members ─────────────────────────────────────────────────────────
-- Returns members of an org with their email. Caller must be a member.
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
  order by om.joined_at asc nulls last;
$$;

-- ── create_invitation ─────────────────────────────────────────────────────────
-- Checks seat limit, revokes existing pending invite for same email, inserts.
-- Returns the invitation token so the caller can build the accept URL.
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
        (select count(*) from public.org_members  where org_id = p_org_id and status = 'active') +
        (select count(*) from public.invitations  where org_id = p_org_id
                                                    and accepted_at is null
                                                    and revoked_at  is null
                                                    and expires_at  > now())
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

-- ── accept_invitation ─────────────────────────────────────────────────────────
-- Validates token, creates org_member, marks invitation accepted. Returns org_id.
create or replace function public.accept_invitation(p_token text)
  returns uuid
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_inv public.invitations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'P0002';
  end if;

  select * into v_inv
  from   public.invitations
  where  token       = p_token
    and  accepted_at is null
    and  revoked_at  is null
    and  expires_at  > now();

  if not found then
    raise exception 'Invitation not found or expired' using errcode = 'P0004';
  end if;

  -- Email must match
  if lower(v_inv.email) != lower((select email from auth.users where id = auth.uid())) then
    raise exception 'This invitation was sent to a different email address' using errcode = 'P0005';
  end if;

  -- Create membership (upsert)
  insert into public.org_members (org_id, user_id, role, status, joined_at)
  values (v_inv.org_id, auth.uid(), v_inv.role, 'active', now())
  on conflict (org_id, user_id) do update
    set role      = excluded.role,
        status    = 'active',
        joined_at = now();

  -- Mark accepted
  update public.invitations set accepted_at = now() where id = v_inv.id;

  -- Activate profile if still pending
  update public.profiles
     set status = 'active'
   where id     = auth.uid()
     and status = 'pending_verification';

  return v_inv.org_id;
end;
$$;

-- ── get_invitation_details ────────────────────────────────────────────────────
-- Public read — no auth required. Used on /invite/:token acceptance page.
create or replace function public.get_invitation_details(p_token text)
  returns json
  language sql
  security definer
  stable
  set search_path = public
as $$
  select json_build_object(
    'id',         i.id,
    'email',      i.email,
    'role',       i.role,
    'expires_at', i.expires_at,
    'is_valid',   (i.accepted_at is null and i.revoked_at is null and i.expires_at > now()),
    'org_name',   o.name,
    'invited_by', p.display_name
  )
  from   public.invitations  i
  join   public.organizations o on o.id = i.org_id
  join   public.profiles      p on p.id = i.invited_by
  where  i.token = p_token
  limit 1;
$$;

-- ── update_member_role ────────────────────────────────────────────────────────
create or replace function public.update_member_role(
  p_org_id    uuid,
  p_member_id uuid,
  p_new_role  text
) returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if not exists (
    select 1 from public.org_members
     where org_id  = p_org_id
       and user_id = auth.uid()
       and status  = 'active'
       and role   in ('owner', 'admin')
  ) then
    raise exception 'Not authorized' using errcode = 'P0002';
  end if;

  update public.org_members
     set role = p_new_role::public.member_role
   where id     = p_member_id
     and org_id = p_org_id;
end;
$$;

-- ── remove_member ─────────────────────────────────────────────────────────────
-- check_sole_owner trigger on org_members already protects the last owner.
create or replace function public.remove_member(
  p_org_id    uuid,
  p_member_id uuid
) returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if not exists (
    select 1 from public.org_members
     where org_id  = p_org_id
       and user_id = auth.uid()
       and status  = 'active'
       and role   in ('owner', 'admin')
  ) then
    raise exception 'Not authorized' using errcode = 'P0002';
  end if;

  delete from public.org_members
   where id     = p_member_id
     and org_id = p_org_id;
end;
$$;

-- ── revoke_invitation ─────────────────────────────────────────────────────────
create or replace function public.revoke_invitation(p_invitation_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  update public.invitations
     set revoked_at = now()
   where id          = p_invitation_id
     and accepted_at is null
     and public.is_org_member(org_id);
end;
$$;

-- ── RLS: profiles visible to org members ─────────────────────────────────────
-- Members can view profiles of others in their org (for team page display names).
create policy "profiles_select_org_members"
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from   public.org_members om1
      join   public.org_members om2 on om1.org_id = om2.org_id
      where  om1.user_id = auth.uid()
        and  om2.user_id = public.profiles.id
        and  om1.status  = 'active'
        and  om2.status  = 'active'
    )
  );

-- ── RLS: invitations SELECT for invitee ──────────────────────────────────────
-- Already covered by invitations_select_admin (email match clause).
-- No additional policy needed.
