-- Migration: review_highlights_cron
-- Purpose: Weekly cron job to auto-extract review highlights for all enabled locations.
-- Schedule: Every Sunday at 4:00 AM PKT (23:00 UTC Saturday)

CREATE OR REPLACE FUNCTION public.cron_extract_review_highlights()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_role_key text;
BEGIN
  SELECT value INTO v_service_role_key
  FROM public.platform_settings
  WHERE key = 'supabase_service_role_key'
  LIMIT 1;

  -- Use the anon key path with service-role bearer if available,
  -- otherwise the edge function accepts the service role key directly.
  PERFORM net.http_post(
    url     := 'https://kgttncfkzdrgswfkkdji.supabase.co/functions/v1/extract-review-highlights',
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'Authorization',  'Bearer ' || coalesce(v_service_role_key, '')
    ),
    body    := '{}'::jsonb
  );
END;
$$;

-- Remove old version if exists
SELECT cron.unschedule(jobname)
FROM   cron.job
WHERE  jobname = 'weekly-review-highlights';

-- Weekly: Sunday 4:00 AM PKT = Saturday 23:00 UTC
SELECT cron.schedule(
  'weekly-review-highlights',
  '0 23 * * 6',
  'SELECT public.cron_extract_review_highlights()'
);
