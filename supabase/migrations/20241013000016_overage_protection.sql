-- Migration 016 — Add overage_protection to subscriptions
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS overage_protection boolean NOT NULL DEFAULT true;

-- Allow authenticated users to update their own overage_protection preference
CREATE POLICY "subscriptions_update_own"
  ON subscriptions FOR UPDATE TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
