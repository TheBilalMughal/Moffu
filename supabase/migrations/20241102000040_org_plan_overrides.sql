-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 040 — Org-level plan overrides (custom enterprise packages)
-- Each field NULl means "use plan default". -1 means "unlimited".
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.org_plan_overrides (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                      uuid        NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Quota overrides (NULL = inherit from plan; -1 = unlimited)
  ai_drafts_per_month         int,
  published_replies_per_month int,
  max_locations               int,
  max_team_members            int,
  campaign_emails_per_month   int,

  -- Custom billing (informational — Stripe still handles the charge separately)
  custom_price_cents          int,
  billing_interval            text CHECK (billing_interval IN ('monthly', 'annual')),

  -- Contract window
  contract_start              date,
  contract_end                date,

  -- Internal notes
  notes                       text,

  -- Audit
  created_by                  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX org_plan_overrides_org_id ON public.org_plan_overrides (org_id);

ALTER TABLE public.org_plan_overrides ENABLE ROW LEVEL SECURITY;

-- Only platform members (admin team) can read/write overrides
CREATE POLICY "platform_members_all"
  ON public.org_plan_overrides
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.platform_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Customers can read their own org's override (so the portal can display their quota)
CREATE POLICY "org_member_read_own"
  ON public.org_plan_overrides
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = org_plan_overrides.org_id
        AND org_members.user_id = auth.uid()
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_org_plan_overrides_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_org_plan_overrides_updated_at
  BEFORE UPDATE ON public.org_plan_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_org_plan_overrides_updated_at();
