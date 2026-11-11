-- Migration: subscription notification tracking
-- Tracks payment failure count and usage notification periods to avoid duplicate emails.

alter table public.subscriptions
  add column if not exists payment_failure_count   int          not null default 0,
  add column if not exists usage_80_notified_period text        default null,  -- 'YYYY-MM'
  add column if not exists usage_100_notified_period text       default null;  -- 'YYYY-MM'

comment on column public.subscriptions.payment_failure_count    is 'Consecutive Paddle payment failures. Reset to 0 on successful payment.';
comment on column public.subscriptions.usage_80_notified_period is 'Billing period (YYYY-MM) when the 80% usage warning email was last sent.';
comment on column public.subscriptions.usage_100_notified_period is 'Billing period (YYYY-MM) when the 100% usage limit email was last sent.';
