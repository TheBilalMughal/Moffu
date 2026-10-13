-- Migration: 011 — Admin portal RLS policies
-- Purpose: Allow active platform members to read/manage data for the admin portal.
-- Security-definer helpers avoid RLS recursion.

-- ─── Helper functions ────────────────────────────────────────────────────────

create or replace function public.is_platform_member()
  returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.platform_members
    where user_id = auth.uid() and is_active = true
  );
$$;

create or replace function public.get_platform_role()
  returns text language sql stable security definer set search_path = public as $$
  select role::text from public.platform_members
  where user_id = auth.uid() and is_active = true
  limit 1;
$$;

-- ─── platform_members ────────────────────────────────────────────────────────

-- Any authenticated user can read their own row (needed for auth check)
create policy "platform_members_read_own"
  on public.platform_members for select to authenticated
  using (user_id = auth.uid());

-- Active platform members can read all rows (for team management)
create policy "platform_members_read_all_by_platform"
  on public.platform_members for select to authenticated
  using (public.is_platform_member());

-- Super admin / admin can add new platform members
create policy "platform_members_insert_by_admin"
  on public.platform_members for insert to authenticated
  with check (public.get_platform_role() in ('super_admin', 'admin'));

-- Super admin / admin can update platform members (trigger protects last super_admin)
create policy "platform_members_update_by_admin"
  on public.platform_members for update to authenticated
  using (public.get_platform_role() in ('super_admin', 'admin'));

-- ─── organizations ───────────────────────────────────────────────────────────

-- Platform members can read all organizations
create policy "orgs_read_by_platform"
  on public.organizations for select to authenticated
  using (public.is_platform_member());

-- ─── profiles ────────────────────────────────────────────────────────────────

-- Platform members can read all profiles
create policy "profiles_read_by_platform"
  on public.profiles for select to authenticated
  using (public.is_platform_member());

-- ─── subscriptions ───────────────────────────────────────────────────────────

-- Platform members can read all subscriptions
create policy "subscriptions_read_by_platform"
  on public.subscriptions for select to authenticated
  using (public.is_platform_member());

-- Platform super_admin / admin can update subscriptions (plan overrides)
create policy "subscriptions_update_by_admin"
  on public.subscriptions for update to authenticated
  using (public.get_platform_role() in ('super_admin', 'admin'));

-- ─── role_permissions ────────────────────────────────────────────────────────

-- Super admin / admin can manage role permissions (matrix editor)
create policy "role_permissions_insert_by_admin"
  on public.role_permissions for insert to authenticated
  with check (public.get_platform_role() in ('super_admin', 'admin'));

create policy "role_permissions_delete_by_admin"
  on public.role_permissions for delete to authenticated
  using (public.get_platform_role() in ('super_admin', 'admin'));

-- ─── customer_permissions ────────────────────────────────────────────────────

-- Super admin can add new permission keys
create policy "customer_permissions_insert_by_superadmin"
  on public.customer_permissions for insert to authenticated
  with check (public.get_platform_role() = 'super_admin');

-- ─── user_permission_overrides ───────────────────────────────────────────────

-- Platform members can read all overrides
create policy "perm_overrides_read_by_platform"
  on public.user_permission_overrides for select to authenticated
  using (public.is_platform_member());

-- Super admin / admin can manage overrides
create policy "perm_overrides_insert_by_admin"
  on public.user_permission_overrides for insert to authenticated
  with check (public.get_platform_role() in ('super_admin', 'admin'));

create policy "perm_overrides_delete_by_admin"
  on public.user_permission_overrides for delete to authenticated
  using (public.get_platform_role() in ('super_admin', 'admin'));

-- ─── org_members ─────────────────────────────────────────────────────────────

-- Platform members can read all org members (for org 360 / user management)
create policy "org_members_read_by_platform"
  on public.org_members for select to authenticated
  using (public.is_platform_member());

-- ─── usage_events ────────────────────────────────────────────────────────────

-- Platform members can read all usage events (for org billing/usage view)
create policy "usage_events_read_by_platform"
  on public.usage_events for select to authenticated
  using (public.is_platform_member());

-- ─── google_connections ──────────────────────────────────────────────────────

-- Platform members can read all Google connections (for troubleshooting)
create policy "google_connections_read_by_platform"
  on public.google_connections for select to authenticated
  using (public.is_platform_member());

-- ─── audit_events ────────────────────────────────────────────────────────────

-- Platform members can read all audit events
create policy "audit_events_read_by_platform"
  on public.audit_events for select to authenticated
  using (public.is_platform_member());

-- Platform operations can insert audit events (for admin actions)
create policy "audit_events_insert_by_platform"
  on public.audit_events for insert to authenticated
  with check (public.is_platform_member());
