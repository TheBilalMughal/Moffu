-- Migration: 003 — User profiles and organizations
-- Purpose: Extends auth.users with profiles, creates organizations and memberships.
-- UUID is the real PK/FK; ref_id is the immutable human-readable identifier.
-- Sole Owner protection: cannot remove the last owner of an org.

-- -----------------------------------------------------------------------
-- User profiles
-- -----------------------------------------------------------------------

create type public.user_status as enum ('active', 'suspended', 'pending_verification');

create table public.profiles (
  id            uuid        primary key references auth.users(id) on delete cascade,
  ref_id        text        not null unique default public.next_ref_id('user'),
  display_name  text        not null,
  avatar_url    text,
  status        public.user_status not null default 'pending_verification',
  -- Soft delete: set deleted_at; never hard delete auth rows
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is
  'Extended user profile. id mirrors auth.users.id. '
  'ref_id is the immutable human-readable identifier (e.g. USR-00001).';

create index idx_profiles_ref_id on public.profiles(ref_id);
create index idx_profiles_status on public.profiles(status) where deleted_at is null;

-- Trigger: auto-create profile on new auth user
create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger: updated_at
create or replace function public.set_updated_at()
  returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------
-- Organizations
-- -----------------------------------------------------------------------

create type public.org_status as enum ('onboarding', 'active', 'suspended');

create table public.organizations (
  id            uuid        primary key default gen_random_uuid(),
  ref_id        text        not null unique default public.next_ref_id('organization'),
  name          text        not null,
  slug          citext      not null unique,
  status        public.org_status not null default 'onboarding',
  country_id    uuid        references public.countries(id),
  timezone      text,         -- IANA timezone; validated at app layer
  currency_code text        references public.currencies(code),
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.organizations is
  'Multi-tenant organization. ref_id is the human-readable route identifier. '
  'slug is case-insensitive unique. status=onboarding until onboarding complete.';

create index idx_organizations_ref_id on public.organizations(ref_id);
create index idx_organizations_slug   on public.organizations(slug) where deleted_at is null;
create index idx_organizations_status on public.organizations(status) where deleted_at is null;

create trigger organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------
-- Organization members
-- -----------------------------------------------------------------------

create type public.member_role   as enum ('owner', 'admin', 'manager', 'viewer');
create type public.member_status as enum ('active', 'invited', 'suspended');

create table public.org_members (
  id          uuid        primary key default gen_random_uuid(),
  org_id      uuid        not null references public.organizations(id) on delete cascade,
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  role        public.member_role   not null default 'viewer',
  status      public.member_status not null default 'invited',
  joined_at   timestamptz,
  invited_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, user_id)
);

comment on table public.org_members is
  'Organization membership. A user may belong to multiple orgs. '
  'Sole Owner protection: removing the last owner is blocked at DB level.';

create index idx_org_members_org_id  on public.org_members(org_id);
create index idx_org_members_user_id on public.org_members(user_id);
create index idx_org_members_role    on public.org_members(org_id, role);

create trigger org_members_updated_at
  before update on public.org_members
  for each row execute function public.set_updated_at();

-- Sole Owner protection: prevent removing/demoting the last owner
create or replace function public.check_sole_owner()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_owner_count int;
begin
  -- On update: if changing away from owner role
  if (TG_OP = 'UPDATE' and OLD.role = 'owner' and NEW.role <> 'owner') or
     (TG_OP = 'DELETE' and OLD.role = 'owner') then
    select count(*)
    into   v_owner_count
    from   public.org_members
    where  org_id = OLD.org_id
      and  role   = 'owner'
      and  status = 'active'
      and  id    <> OLD.id;

    if v_owner_count = 0 then
      raise exception 'Cannot remove or demote the sole owner of organization %', OLD.org_id
        using errcode = 'P0001';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger protect_sole_owner
  before update or delete on public.org_members
  for each row execute function public.check_sole_owner();

-- -----------------------------------------------------------------------
-- Invitations
-- -----------------------------------------------------------------------

create table public.invitations (
  id          uuid        primary key default gen_random_uuid(),
  ref_id      text        not null unique default public.next_ref_id('invitation'),
  org_id      uuid        not null references public.organizations(id) on delete cascade,
  invited_by  uuid        not null references public.profiles(id),
  email       citext      not null,
  role        public.member_role not null default 'viewer',
  token       text        not null unique default encode(gen_random_bytes(32), 'base64url'),
  expires_at  timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);

comment on table public.invitations is
  'Team invitations. Token is single-use and expires in 7 days. '
  'Acceptance creates/updates org_members row atomically.';

create index idx_invitations_token   on public.invitations(token) where accepted_at is null and revoked_at is null;
create index idx_invitations_email   on public.invitations(email) where accepted_at is null;
create index idx_invitations_org_id  on public.invitations(org_id);

-- -----------------------------------------------------------------------
-- RLS policies
-- -----------------------------------------------------------------------

alter table public.profiles      enable row level security;
alter table public.organizations enable row level security;
alter table public.org_members   enable row level security;
alter table public.invitations   enable row level security;

-- Profiles: users see/update their own profile
create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Helper: is the current user an active member of this org?
create or replace function public.is_org_member(p_org_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1 from public.org_members
    where  org_id  = p_org_id
      and  user_id = auth.uid()
      and  status  = 'active'
  );
$$;

-- Helper: what role does the current user have in this org?
create or replace function public.org_member_role(p_org_id uuid)
  returns public.member_role
  language sql
  stable
  security definer
  set search_path = public
as $$
  select role from public.org_members
  where  org_id  = p_org_id
    and  user_id = auth.uid()
    and  status  = 'active'
  limit 1;
$$;

-- Organizations: members can read their org
create policy "organizations_select_members"
  on public.organizations for select to authenticated
  using (public.is_org_member(id));

-- Org members: members can see fellow members
create policy "org_members_select"
  on public.org_members for select to authenticated
  using (public.is_org_member(org_id));

-- Invitations: org owners/admins can see pending invitations for their org
create policy "invitations_select_admin"
  on public.invitations for select to authenticated
  using (
    public.org_member_role(org_id) in ('owner', 'admin')
    or email = (select email from auth.users where id = auth.uid())
  );
