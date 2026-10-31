-- ── Cron Jobs ─────────────────────────────────────────────────────────────────
-- Requires pg_cron and pg_net (both already installed on this project).
--
-- Job 1: Daily reviews sync        — 2:00 AM PKT (21:00 UTC)
-- Job 2: Feedback expiry            — every hour
-- Job 3: Usage events cleanup       — weekly Sunday 3:00 AM PKT (22:00 UTC Sat)
-- ─────────────────────────────────────────────────────────────────────────────

-- Seed a sync secret if not already present (google-sync-all reads this)
INSERT INTO public.platform_settings (key, value)
VALUES ('sync_reviews_secret', gen_random_uuid()::text)
ON CONFLICT (key) DO NOTHING;

-- ── Helper functions ──────────────────────────────────────────────────────────

-- Job 1: call google-sync-all edge function with stored cron secret
CREATE OR REPLACE FUNCTION public.cron_sync_reviews()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT value INTO v_secret
  FROM public.platform_settings
  WHERE key = 'sync_reviews_secret';

  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE LOG 'cron_sync_reviews: no sync_reviews_secret set, skipping';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := 'https://kgttncfkzdrgswfkkdji.supabase.co/functions/v1/google-sync-all',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-sync-secret', v_secret
    ),
    body    := '{}'::jsonb
  );
END;
$$;

-- Job 2: mark expired feedback requests
CREATE OR REPLACE FUNCTION public.cron_expire_feedback()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.feedback_requests
  SET    status = 'EXPIRED'
  WHERE  expires_at < now()
    AND  status = 'PENDING';
$$;

-- Job 3: remove usage_events older than 90 days (keeps billing table lean)
CREATE OR REPLACE FUNCTION public.cron_cleanup_usage_events()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.usage_events
  WHERE created_at < now() - interval '90 days';
$$;

-- ── Schedule ──────────────────────────────────────────────────────────────────

-- Remove old versions of these jobs if they exist (idempotent)
SELECT cron.unschedule(jobname)
FROM   cron.job
WHERE  jobname IN ('daily-review-sync', 'feedback-expiry', 'usage-events-cleanup');

-- Daily review sync: 2:00 AM PKT = 21:00 UTC
SELECT cron.schedule(
  'daily-review-sync',
  '0 21 * * *',
  'SELECT public.cron_sync_reviews()'
);

-- Feedback expiry check: every hour
SELECT cron.schedule(
  'feedback-expiry',
  '0 * * * *',
  'SELECT public.cron_expire_feedback()'
);

-- Usage events cleanup: every Sunday 3:00 AM PKT = Saturday 22:00 UTC
SELECT cron.schedule(
  'usage-events-cleanup',
  '0 22 * * 6',
  'SELECT public.cron_cleanup_usage_events()'
);
