-- Admin-triggered outreach log with 24h cooldown enforcement
CREATE TABLE IF NOT EXISTS public.admin_outreach_log (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email_type text        NOT NULL,
  to_email   text        NOT NULL,
  sent_at    timestamptz NOT NULL DEFAULT now(),
  sent_by    uuid        REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS admin_outreach_log_org_type_idx
  ON public.admin_outreach_log(org_id, email_type, sent_at DESC);

ALTER TABLE public.admin_outreach_log ENABLE ROW LEVEL SECURITY;

-- Only platform members can read; nobody can write directly (edge function uses service role)
CREATE POLICY "platform_members_can_read" ON public.admin_outreach_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.platform_members WHERE user_id = auth.uid())
  );

CREATE POLICY "no_direct_write" ON public.admin_outreach_log
  FOR ALL USING (false)
  WITH CHECK (false);
