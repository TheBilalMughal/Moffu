-- Migration: 049 — Add 'owner' platform role to all admin-only RLS policies
-- Every policy that previously allowed super_admin+admin now also allows owner.

-- role_permissions
DROP POLICY IF EXISTS role_permissions_insert_by_admin ON public.role_permissions;
DROP POLICY IF EXISTS role_permissions_delete_by_admin ON public.role_permissions;
CREATE POLICY role_permissions_insert_by_admin ON public.role_permissions
  FOR INSERT WITH CHECK (get_platform_role() = ANY (ARRAY['owner','super_admin','admin']));
CREATE POLICY role_permissions_delete_by_admin ON public.role_permissions
  FOR DELETE USING (get_platform_role() = ANY (ARRAY['owner','super_admin','admin']));

-- role_permission_audit
DROP POLICY IF EXISTS platform_admins_insert_rpa ON public.role_permission_audit;
CREATE POLICY platform_admins_insert_rpa ON public.role_permission_audit
  FOR INSERT WITH CHECK (get_platform_role() = ANY (ARRAY['owner','super_admin','admin']));

-- user_permission_overrides
DROP POLICY IF EXISTS perm_overrides_insert_by_admin ON public.user_permission_overrides;
DROP POLICY IF EXISTS perm_overrides_delete_by_admin ON public.user_permission_overrides;
CREATE POLICY perm_overrides_insert_by_admin ON public.user_permission_overrides
  FOR INSERT WITH CHECK (get_platform_role() = ANY (ARRAY['owner','super_admin','admin']));
CREATE POLICY perm_overrides_delete_by_admin ON public.user_permission_overrides
  FOR DELETE USING (get_platform_role() = ANY (ARRAY['owner','super_admin','admin']));

-- customer_permissions
DROP POLICY IF EXISTS customer_permissions_insert_by_superadmin ON public.customer_permissions;
CREATE POLICY customer_permissions_insert_by_superadmin ON public.customer_permissions
  FOR INSERT WITH CHECK (get_platform_role() = ANY (ARRAY['owner','super_admin']));

-- plans, plan_prices, plan_entitlements, plan_location_addons
DROP POLICY IF EXISTS plans_admin_all ON public.plans;
CREATE POLICY plans_admin_all ON public.plans
  FOR ALL USING (get_platform_role() = ANY (ARRAY['owner','super_admin','admin']))
  WITH CHECK (get_platform_role() = ANY (ARRAY['owner','super_admin','admin']));

DROP POLICY IF EXISTS plan_prices_admin_all ON public.plan_prices;
CREATE POLICY plan_prices_admin_all ON public.plan_prices
  FOR ALL USING (get_platform_role() = ANY (ARRAY['owner','super_admin','admin']))
  WITH CHECK (get_platform_role() = ANY (ARRAY['owner','super_admin','admin']));

DROP POLICY IF EXISTS plan_entitlements_admin_all ON public.plan_entitlements;
CREATE POLICY plan_entitlements_admin_all ON public.plan_entitlements
  FOR ALL USING (get_platform_role() = ANY (ARRAY['owner','super_admin','admin']))
  WITH CHECK (get_platform_role() = ANY (ARRAY['owner','super_admin','admin']));

DROP POLICY IF EXISTS plan_location_addons_admin_all ON public.plan_location_addons;
CREATE POLICY plan_location_addons_admin_all ON public.plan_location_addons
  FOR ALL USING (get_platform_role() = ANY (ARRAY['owner','super_admin','admin']))
  WITH CHECK (get_platform_role() = ANY (ARRAY['owner','super_admin','admin']));

-- subscriptions
DROP POLICY IF EXISTS subscriptions_update_by_admin ON public.subscriptions;
CREATE POLICY subscriptions_update_by_admin ON public.subscriptions
  FOR UPDATE USING (get_platform_role() = ANY (ARRAY['owner','super_admin','admin']));

-- org_support_notes
DROP POLICY IF EXISTS support_notes_admin_all ON public.org_support_notes;
CREATE POLICY support_notes_admin_all ON public.org_support_notes
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.platform_members
    WHERE user_id = auth.uid() AND is_active = true
      AND role = ANY (ARRAY['owner'::platform_role,'super_admin'::platform_role,'admin'::platform_role,'finance'::platform_role,'support'::platform_role,'operations'::platform_role])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.platform_members
    WHERE user_id = auth.uid() AND is_active = true
      AND role = ANY (ARRAY['owner'::platform_role,'super_admin'::platform_role,'admin'::platform_role,'finance'::platform_role,'support'::platform_role,'operations'::platform_role])
  ));

-- refund_requests
DROP POLICY IF EXISTS refund_requests_admin_all ON public.refund_requests;
CREATE POLICY refund_requests_admin_all ON public.refund_requests
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.platform_members
    WHERE user_id = auth.uid() AND is_active = true
      AND role = ANY (ARRAY['owner'::platform_role,'super_admin'::platform_role,'admin'::platform_role,'finance'::platform_role,'support'::platform_role,'operations'::platform_role])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.platform_members
    WHERE user_id = auth.uid() AND is_active = true
      AND role = ANY (ARRAY['owner'::platform_role,'super_admin'::platform_role,'admin'::platform_role,'finance'::platform_role,'support'::platform_role,'operations'::platform_role])
  ));
