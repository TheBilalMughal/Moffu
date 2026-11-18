-- Migration: monthly_digests
-- Purpose: Store AI-generated monthly review digests per org.

CREATE TABLE IF NOT EXISTS public.monthly_digests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  month           TEXT        NOT NULL, -- 'YYYY-MM', e.g. '2026-11'

  -- Review stats for the month
  review_count    INTEGER     NOT NULL DEFAULT 0,
  avg_rating      NUMERIC(3,2),
  avg_rating_prev NUMERIC(3,2), -- previous month avg for delta comparison
  reply_rate      INTEGER,       -- 0–100 percentage
  pending_count   INTEGER     NOT NULL DEFAULT 0,
  rating_dist     JSONB,         -- {"1":n,"2":n,"3":n,"4":n,"5":n}
  top_topics      JSONB,         -- [{topic,label,positive,negative,neutral,total}]

  -- AI-generated content
  summary_text    TEXT,          -- one-paragraph plain text overview
  insights_html   TEXT,          -- HTML block of AI insights
  action_items    JSONB,         -- [{title,description}]

  -- Email delivery
  email_subject   TEXT,
  sent_at         TIMESTAMPTZ,
  sent_to         JSONB,         -- ["email1@...", "email2@..."]

  generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (org_id, month)
);

COMMENT ON TABLE public.monthly_digests IS
  'AI-generated monthly review digest per org. One row per org per month.';

CREATE INDEX idx_monthly_digests_org_month
  ON public.monthly_digests (org_id, month DESC);

-- RLS: org members can read their own digests
ALTER TABLE public.monthly_digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monthly_digests_select_org_member"
  ON public.monthly_digests FOR SELECT
  USING (
    org_id IN (
      SELECT om.org_id FROM public.org_members om
      WHERE om.user_id = auth.uid() AND om.status = 'active'
    )
  );

-- pg_cron: run generate-monthly-digest on the 1st of each month at 08:00 UTC
-- Requires pg_cron and pg_net extensions (enabled on all Supabase projects).
SELECT cron.schedule(
  'monthly-digest-job',
  '0 8 1 * *',
  $cron$
  SELECT net.http_post(
    url     := 'https://kgttncfkzdrgswfkkdji.supabase.co/functions/v1/generate-monthly-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.cron_secret', true)
    ),
    body    := '{}'::jsonb
  );
  $cron$
);
