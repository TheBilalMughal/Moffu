-- Add display fields to plans table for website pricing page
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS description  text,
  ADD COLUMN IF NOT EXISTS features     jsonb    NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS badge_text   text,
  ADD COLUMN IF NOT EXISTS is_featured  boolean  NOT NULL DEFAULT false;

-- Allow anonymous (public website) to read active plans + prices
CREATE POLICY "plans_anon_read"
  ON public.plans FOR SELECT TO anon USING (is_active = true);

CREATE POLICY "plan_prices_anon_read"
  ON public.plan_prices FOR SELECT TO anon USING (is_active = true);

CREATE POLICY "plan_entitlements_anon_read"
  ON public.plan_entitlements FOR SELECT TO anon USING (true);
