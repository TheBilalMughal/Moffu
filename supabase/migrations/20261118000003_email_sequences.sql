-- email_sequences: deduplication table for transactional emails
CREATE TABLE IF NOT EXISTS public.email_sequences (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sequence_type   text NOT NULL,
  sent_at         timestamptz NOT NULL DEFAULT now(),
  metadata        jsonb,
  UNIQUE(user_id, sequence_type)
);

CREATE INDEX IF NOT EXISTS email_sequences_user_id_idx ON public.email_sequences(user_id);

ALTER TABLE public.email_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "no_access_authenticated" ON public.email_sequences
  FOR ALL USING (false);

-- Trigger function: on review INSERT → call send-first-review-email
CREATE OR REPLACE FUNCTION public.trigger_first_review_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://kgttncfkzdrgswfkkdji.supabase.co/functions/v1/send-first-review-email',
    headers := '{"Content-Type":"application/json","x-webhook-secret":"moffu-first-review-2026"}'::jsonb,
    body    := jsonb_build_object(
      'user_id',       NEW.user_id,
      'location_id',   NEW.location_id,
      'review_id',     NEW.id,
      'reviewer_name', NEW.reviewer_name,
      'rating',        NEW.rating,
      'body',          NEW.body
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_review_created_first_review_email ON public.reviews;
CREATE TRIGGER on_review_created_first_review_email
  AFTER INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_first_review_email();

-- SQL wrapper for pg_cron → send-onboarding-emails (24h Google connect reminder)
CREATE OR REPLACE FUNCTION public.cron_send_onboarding_emails()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://kgttncfkzdrgswfkkdji.supabase.co/functions/v1/send-onboarding-emails',
    headers := '{"Content-Type":"application/json","x-webhook-secret":"moffu-onboarding-cron-2026"}'::jsonb,
    body    := '{}'::jsonb
  );
END;
$$;

SELECT cron.schedule(
  'send-onboarding-emails',
  '30 * * * *',
  'SELECT public.cron_send_onboarding_emails()'
);
