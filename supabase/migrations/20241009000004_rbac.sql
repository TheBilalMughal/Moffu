-- Migration: 004 — Customer RBAC and platform roles
-- Purpose: Customer role permissions, platform (internal) roles, overrides.
-- Backend/RLS is the authority — UI visibility is a convenience layer only.

-- -----------------------------------------------------------------------
-- Customer permissions
-- -----------------------------------------------------------------------

create table public.customer_permissions (
  id            uuid    primary key default gen_random_uuid(),
  key           text    not null unique,  -- e.g. 'reviews.generate'
  description   text    not null,
  created_at    timestamptz not null default now()
);

comment on table public.customer_permissions is
  'Registry of all customer-facing permission keys. '
  'Checked server-side; UI uses these for visibility only.';

-- Seed permission registry
insert into public.customer_permissions (key, description) values
  ('reviews.view',        'View reviews and their status'),
  ('reviews.generate',    'Generate AI draft replies'),
  ('reviews.edit',        'Edit draft replies'),
  ('reviews.approve',     'Approve draft replies for publishing'),
  ('reviews.publish',     'Publish approved replies to Google'),
  ('reviews.reject',      'Reject draft replies'),
  ('brand_brain.view',    'View Brand Brain configuration'),
  ('brand_brain.edit',    'Edit Brand Brain configuration'),
  ('reports.view',        'View reputation reports'),
  ('reports.export',      'Export reports'),
  ('google.connect',      'Connect Google Business Profile'),
  ('google.disconnect',   'Disconnect Google Business Profile'),
  ('locations.view',      'View locations'),
  ('locations.manage',    'Manage location settings'),
  ('team.view',           'View team members'),
  ('team.invite',         'Invite new team members'),
  ('team.manage',         'Manage team members and roles'),
  ('billing.view',        'View billing information'),
  ('billing.manage',      'Manage billing and subscriptions'),
  ('settings.view',       'View organization settings'),
  ('settings.manage',     'Manage organization settings'),
  ('notifications.manage','Manage notification preferences'),
  ('support.create',      'Create support tickets'),
  ('privacy.request',     'Submit privacy/data requests');

-- Base permissions per role (no overrides applied here)
create table public.role_permissions (
  id          uuid    primary key default gen_random_uuid(),
  role        public.member_role not null,
  permission  text    not null references public.customer_permissions(key),
  unique (role, permission)
);

comment on table public.role_permissions is
  'Default permissions granted to each customer role. '
  'Overrides are applied on top via user_permission_overrides.';

-- Owner: all permissions
insert into public.role_permissions (role, permission)
select 'owner', key from public.customer_permissions;

-- Admin: all except billing.manage
insert into public.role_permissions (role, permission)
select 'admin', key from public.customer_permissions
where key not in ('billing.manage');

-- Manager: reviews + brand brain + reports + locations.view + team.view + support
insert into public.role_permissions (role, permission)
select 'manager', key from public.customer_permissions
where key in (
  'reviews.view', 'reviews.generate', 'reviews.edit', 'reviews.approve', 'reviews.publish', 'reviews.reject',
  'brand_brain.view', 'brand_brain.edit',
  'reports.view',
  'locations.view',
  'team.view',
  'settings.view',
  'notifications.manage',
  'support.create',
  'privacy.request'
);

-- Viewer: read-only
insert into public.role_permissions (role, permission)
select 'viewer', key from public.customer_permissions
where key in (
  'reviews.view',
  'brand_brain.view',
  'reports.view',
  'locations.view',
  'team.view',
  'settings.view',
  'support.create',
  'privacy.request'
);

-- -----------------------------------------------------------------------
-- User-level permission overrides (allow or deny per user/org/location)
-- -----------------------------------------------------------------------

create type public.permission_effect as enum ('allow', 'deny');

create table public.user_permission_overrides (
  id              uuid        primary key default gen_random_uuid(),
  org_id          uuid        not null references public.organizations(id) on delete cascade,
  user_id         uuid        not null references public.profiles(id) on delete cascade,
  permission      text        not null references public.customer_permissions(key),
  effect          public.permission_effect not null,
  scope_location_id uuid,     -- NULL = org-wide; set = location-scoped
  created_by      uuid        references public.profiles(id),
  created_at      timestamptz not null default now(),
  unique (org_id, user_id, permission, coalesce(scope_location_id, '00000000-0000-0000-0000-000000000000'::uuid))
);

comment on table public.user_permission_overrides is
  'Per-user permission overrides. Explicit DENY wins over any ALLOW. '
  'scope_location_id=NULL means org-wide; otherwise location-scoped.';

create index idx_perm_overrides_user on public.user_permission_overrides(org_id, user_id);

-- -----------------------------------------------------------------------
-- Platform (internal admin) roles
-- -----------------------------------------------------------------------

create type public.platform_role as enum (
  'super_admin', 'admin', 'finance', 'support', 'operations', 'viewer'
);

create table public.platform_members (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null unique references public.profiles(id) on delete cascade,
  role        public.platform_role not null,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.platform_members is
  'Internal admin team members. Strictly separate from organization roles. '
  'Super Admin: cannot be removed if last super admin.';

create trigger platform_members_updated_at
  before update on public.platform_members
  for each row execute function public.set_updated_at();

-- Last Super Admin protection
create or replace function public.check_last_super_admin()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_count int;
begin
  if (TG_OP = 'UPDATE' and OLD.role = 'super_admin' and (NEW.role <> 'super_admin' or not NEW.is_active)) or
     (TG_OP = 'DELETE' and OLD.role = 'super_admin') then
    select count(*) into v_count
    from   public.platform_members
    where  role = 'super_admin' and is_active = true and id <> OLD.id;

    if v_count = 0 then
      raise exception 'Cannot remove or demote the last Super Admin'
        using errcode = 'P0001';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger protect_last_super_admin
  before update or delete on public.platform_members
  for each row execute function public.check_last_super_admin();

-- -----------------------------------------------------------------------
-- Permission resolution helper
-- (base role permissions + overrides; DENY wins)
-- -----------------------------------------------------------------------

create or replace function public.has_permission(
  p_user_id  uuid,
  p_org_id   uuid,
  p_key      text,
  p_location_id uuid default null
) returns boolean
  language plpgsql
  stable
  security definer
  set search_path = public
as $$
declare
  v_role       public.member_role;
  v_has_base   boolean;
  v_override   public.permission_effect;
begin
  -- Get user role in org
  select role into v_role
  from   public.org_members
  where  org_id = p_org_id and user_id = p_user_id and status = 'active';

  if v_role is null then return false; end if;

  -- Check base role permission
  select exists(
    select 1 from public.role_permissions
    where role = v_role and permission = p_key
  ) into v_has_base;

  -- Check explicit overrides (DENY wins; location-scoped then org-wide)
  select effect into v_override
  from   public.user_permission_overrides
  where  org_id   = p_org_id
    and  user_id  = p_user_id
    and  permission = p_key
    and  (scope_location_id = p_location_id or scope_location_id is null)
  order by scope_location_id nulls last  -- prefer location-scoped
  limit 1;

  if v_override = 'deny' then return false; end if;
  if v_override = 'allow' then return true; end if;

  return v_has_base;
end;
$$;

-- -----------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------

alter table public.customer_permissions       enable row level security;
alter table public.role_permissions           enable row level security;
alter table public.user_permission_overrides  enable row level security;
alter table public.platform_members           enable row level security;

-- Authenticated users can read the permission registry
create policy "customer_permissions_read"
  on public.customer_permissions for select to authenticated using (true);

create policy "role_permissions_read"
  on public.role_permissions for select to authenticated using (true);

-- Users see their own permission overrides
create policy "perm_overrides_select_self"
  on public.user_permission_overrides for select to authenticated
  using (user_id = auth.uid() or public.org_member_role(org_id) in ('owner', 'admin'));

-- Platform members: only platform admins can see this table (enforced by service role)
-- RLS blocks direct client reads; trusted platform operations use service-role
