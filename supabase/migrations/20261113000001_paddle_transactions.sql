-- paddle_transactions: stores completed Paddle payment history per user

CREATE TABLE IF NOT EXISTS paddle_transactions (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paddle_transaction_id    TEXT        NOT NULL,
  paddle_subscription_id   TEXT,
  plan_name                TEXT,
  billing_interval         TEXT,
  amount_cents             INTEGER     NOT NULL,
  currency                 TEXT        NOT NULL DEFAULT 'USD',
  status                   TEXT        NOT NULL DEFAULT 'completed',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS paddle_transactions_paddle_id_idx
  ON paddle_transactions (paddle_transaction_id);

CREATE INDEX IF NOT EXISTS paddle_transactions_user_id_idx
  ON paddle_transactions (user_id, created_at DESC);

ALTER TABLE paddle_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own transactions"
  ON paddle_transactions FOR SELECT
  USING (auth.uid() = user_id);
