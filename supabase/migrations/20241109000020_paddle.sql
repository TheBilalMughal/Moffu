-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 020 — Paddle Billing integration columns
-- ─────────────────────────────────────────────────────────────────────────────

-- Paddle price IDs on plan_prices (one per interval per plan)
ALTER TABLE plan_prices
  ADD COLUMN IF NOT EXISTS paddle_price_id text;

-- Paddle subscription/customer IDs on subscriptions
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS paddle_subscription_id text,
  ADD COLUMN IF NOT EXISTS paddle_customer_id      text,
  ADD COLUMN IF NOT EXISTS paddle_transaction_id   text;

-- Fast webhook lookups
CREATE INDEX IF NOT EXISTS subscriptions_paddle_sub_id
  ON subscriptions (paddle_subscription_id)
  WHERE paddle_subscription_id IS NOT NULL;
