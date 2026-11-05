-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 042 — Refund requests + org support notes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE refund_requests (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id uuid        REFERENCES subscriptions(id),
  requested_by    uuid        NOT NULL REFERENCES auth.users(id),
  amount_cents    int,
  reason          text        NOT NULL,
  status          text        NOT NULL DEFAULT 'REQUESTED'
                              CHECK (status IN ('REQUESTED','UNDER_REVIEW','APPROVED','REJECTED','PROCESSING','REFUNDED','FAILED')),
  admin_note      text,
  reviewed_by     uuid        REFERENCES auth.users(id),
  reviewed_at     timestamptz,
  processed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX refund_requests_org_id      ON refund_requests (org_id);
CREATE INDEX refund_requests_status      ON refund_requests (status);
CREATE INDEX refund_requests_created_at  ON refund_requests (created_at DESC);

CREATE TABLE org_support_notes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  author_id   uuid        NOT NULL REFERENCES auth.users(id),
  body        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX org_support_notes_org_id ON org_support_notes (org_id);

-- RLS — only platform admins can read/write
ALTER TABLE refund_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_support_notes ENABLE ROW LEVEL SECURITY;

-- Customers can insert their own refund request
CREATE POLICY "refund_requests_customer_insert"
  ON refund_requests FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());

-- Customers can read their own org's requests
CREATE POLICY "refund_requests_org_read"
  ON refund_requests FOR SELECT TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Platform admins have full access
CREATE POLICY "refund_requests_admin_all"
  ON refund_requests FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM platform_members
      WHERE user_id = auth.uid()
        AND is_active = true
        AND role IN ('super_admin','admin','finance','support','operations')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM platform_members
      WHERE user_id = auth.uid()
        AND is_active = true
        AND role IN ('super_admin','admin','finance','support','operations')
    )
  );

CREATE POLICY "support_notes_admin_all"
  ON org_support_notes FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM platform_members
      WHERE user_id = auth.uid()
        AND is_active = true
        AND role IN ('super_admin','admin','finance','support','operations')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM platform_members
      WHERE user_id = auth.uid()
        AND is_active = true
        AND role IN ('super_admin','admin','finance','support','operations')
    )
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER refund_requests_updated_at
  BEFORE UPDATE ON refund_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
