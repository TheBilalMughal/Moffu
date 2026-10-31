-- Change daily-review-sync from once-daily to hourly so it supports
-- per-user 12h / custom intervals (the edge function skips users whose
-- interval has not elapsed since their last_synced_at).

SELECT cron.unschedule(jobname)
FROM   cron.job
WHERE  jobname = 'daily-review-sync';

SELECT cron.schedule(
  'daily-review-sync',
  '0 * * * *',
  'SELECT public.cron_sync_reviews()'
);
