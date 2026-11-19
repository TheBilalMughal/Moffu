-- Add trial_ends_at to subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;
