-- Migration: 009 — Onboarding RPCs
-- Purpose: Server-side functions for creating and completing an organization
-- during the new-user onboarding wizard. Security definer so the anon client
-- can insert into organizations/org_members without needing direct INSERT RLS.

-- ── create_organization ─────────────────────────────────────────────────────
-- Creates an org + owner membership atomically. Returns the new org's UUID.
-- V1: one org per user (owner role).

create or replace function public.create_organization(
  p_name       text,
  p_slug       text,
  p_country_id uuid default null,
  p_timezone   text default null
) returns uuid
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'P0002';
  end if;

  -- V1: each user belongs to exactly one org
  if exists (
    select 1 from public.org_members
     where user_id = auth.uid()
       and status  = 'active'
  ) then
    raise exception 'User already belongs to an organization' using errcode = 'P0003';
  end if;

  insert into public.organizations (name, slug, status, country_id, timezone)
  values (p_name, lower(p_slug), 'onboarding', p_country_id, p_timezone)
  returning id into v_org_id;

  insert into public.org_members (org_id, user_id, role, status, joined_at)
  values (v_org_id, auth.uid(), 'owner', 'active', now());

  -- Activate profile (was pending_verification)
  update public.profiles
     set status = 'active'
   where id = auth.uid();

  return v_org_id;
end;
$$;

-- ── update_org_location ─────────────────────────────────────────────────────
-- Sets country and/or timezone on the user's org. Owner or admin only.

create or replace function public.update_org_location(
  p_org_id     uuid,
  p_country_id uuid default null,
  p_timezone   text default null
) returns void
  language plpgsql
  security definer
  set search_path = public
as $$
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

  update public.organizations
     set country_id = coalesce(p_country_id, country_id),
         timezone   = coalesce(p_timezone,   timezone)
   where id = p_org_id;
end;
$$;

-- ── complete_onboarding ──────────────────────────────────────────────────────
-- Marks the org as active, closing the onboarding state.

create or replace function public.complete_onboarding(p_org_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'P0002';
  end if;

  if not public.is_org_member(p_org_id) then
    raise exception 'Not a member of this organization' using errcode = 'P0002';
  end if;

  update public.organizations
     set status = 'active'
   where id     = p_org_id
     and status = 'onboarding';
end;
$$;
