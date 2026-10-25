-- Allow platform admins to manage plans, prices, and entitlements

CREATE POLICY "plans_admin_all"
  ON public.plans FOR ALL TO authenticated
  USING      (public.get_platform_role() IN ('super_admin', 'admin'))
  WITH CHECK (public.get_platform_role() IN ('super_admin', 'admin'));

CREATE POLICY "plan_prices_admin_all"
  ON public.plan_prices FOR ALL TO authenticated
  USING      (public.get_platform_role() IN ('super_admin', 'admin'))
  WITH CHECK (public.get_platform_role() IN ('super_admin', 'admin'));

CREATE POLICY "plan_entitlements_admin_all"
  ON public.plan_entitlements FOR ALL TO authenticated
  USING      (public.get_platform_role() IN ('super_admin', 'admin'))
  WITH CHECK (public.get_platform_role() IN ('super_admin', 'admin'));

CREATE POLICY "plan_location_addons_admin_all"
  ON public.plan_location_addons FOR ALL TO authenticated
  USING      (public.get_platform_role() IN ('super_admin', 'admin'))
  WITH CHECK (public.get_platform_role() IN ('super_admin', 'admin'));
