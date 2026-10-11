-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 008 — Billing: plans, entitlements, subscriptions, usage
-- ─────────────────────────────────────────────────────────────────────────────

-- Plans catalog (admin-managed)
CREATE TABLE plans (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text        UNIQUE NOT NULL,
  name        text        NOT NULL,
  is_active   boolean     NOT NULL DEFAULT true,
  sort_order  int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Prices per plan per interval
CREATE TABLE plan_prices (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         uuid        NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  currency        text        NOT NULL DEFAULT 'USD',
  interval        text        NOT NULL CHECK (interval IN ('monthly', 'annual')),
  amount_cents    int         NOT NULL,            -- monthly charge amount
  stripe_price_id text,                            -- set when Stripe configured
  is_active       boolean     NOT NULL DEFAULT true,
  UNIQUE (plan_id, currency, interval)
);

-- Entitlements per plan
CREATE TABLE plan_entitlements (
  id           uuid   PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id      uuid   NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  key          text   NOT NULL,
  value_type   text   NOT NULL CHECK (value_type IN ('LIMIT','BOOLEAN','UNLIMITED','ENUM')),
  limit_value  bigint,
  bool_value   boolean,
  enum_value   text,
  usage_reset  text   CHECK (usage_reset IN ('weekly','monthly','never')),
  UNIQUE (plan_id, key)
);

-- Location add-on pricing per plan
CREATE TABLE plan_location_addons (
  id              uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         uuid  NOT NULL REFERENCES plans(id) ON DELETE CASCADE UNIQUE,
  unit_price_cents int  NOT NULL,   -- per extra location per month
  stripe_price_id text
);

-- Subscriptions (one active per user)
CREATE TABLE subscriptions (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id               uuid        NOT NULL REFERENCES plans(id),
  status                text        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','trialing','past_due','canceled','unpaid','paused')),
  billing_interval      text        CHECK (billing_interval IN ('monthly','annual')),
  current_period_start  timestamptz NOT NULL DEFAULT now(),
  current_period_end    timestamptz NOT NULL DEFAULT now() + interval '100 years',
  cancel_at_period_end  boolean     NOT NULL DEFAULT false,
  stripe_subscription_id text,
  stripe_customer_id    text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)   -- one active subscription per user
);

-- Extra location add-ons on a subscription
CREATE TABLE subscription_addons (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid        NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  addon_type      text        NOT NULL DEFAULT 'extra_location',
  quantity        int         NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_cents int        NOT NULL,
  stripe_addon_id text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Usage events (ai_draft, published_reply)
CREATE TABLE usage_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type  text        NOT NULL CHECK (event_type IN ('ai_draft','published_reply')),
  review_id   uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX usage_events_user_type_created ON usage_events (user_id, event_type, created_at DESC);

-- ─── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE plans               ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_prices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_entitlements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_location_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events        ENABLE ROW LEVEL SECURITY;

-- Plans/prices/entitlements: public read (anyone logged in can see plan catalog)
CREATE POLICY "plans_read"              ON plans              FOR SELECT TO authenticated USING (true);
CREATE POLICY "plan_prices_read"        ON plan_prices        FOR SELECT TO authenticated USING (true);
CREATE POLICY "plan_entitlements_read"  ON plan_entitlements  FOR SELECT TO authenticated USING (true);
CREATE POLICY "plan_location_addons_read" ON plan_location_addons FOR SELECT TO authenticated USING (true);

-- Subscriptions: user sees only their own
CREATE POLICY "subscriptions_own"       ON subscriptions      FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "subscription_addons_own" ON subscription_addons FOR SELECT TO authenticated
  USING (subscription_id IN (SELECT id FROM subscriptions WHERE user_id = auth.uid()));

-- Usage events: user sees only their own
CREATE POLICY "usage_events_own_read"   ON usage_events FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "usage_events_own_insert" ON usage_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ─── Seed: Plan catalog ──────────────────────────────────────────────────────

INSERT INTO plans (slug, name, sort_order) VALUES
  ('free',    'Free',    0),
  ('starter', 'Starter', 1),
  ('growth',  'Growth',  2),
  ('scale',   'Scale',   3);

-- Prices (USD, cents)
INSERT INTO plan_prices (plan_id, currency, interval, amount_cents) VALUES
  -- Free: $0
  ((SELECT id FROM plans WHERE slug='free'),    'USD', 'monthly',  0),
  -- Starter: $19/mo or $15.20/mo ($182.40/yr)
  ((SELECT id FROM plans WHERE slug='starter'), 'USD', 'monthly',  1900),
  ((SELECT id FROM plans WHERE slug='starter'), 'USD', 'annual',   1520),
  -- Growth: $49/mo or $39.20/mo ($470.40/yr)
  ((SELECT id FROM plans WHERE slug='growth'),  'USD', 'monthly',  4900),
  ((SELECT id FROM plans WHERE slug='growth'),  'USD', 'annual',   3920),
  -- Scale: $99/mo or $79.20/mo ($950.40/yr)
  ((SELECT id FROM plans WHERE slug='scale'),   'USD', 'monthly',  9900),
  ((SELECT id FROM plans WHERE slug='scale'),   'USD', 'annual',   7920);

-- Location add-on prices per plan
INSERT INTO plan_location_addons (plan_id, unit_price_cents) VALUES
  ((SELECT id FROM plans WHERE slug='starter'), 500),
  ((SELECT id FROM plans WHERE slug='growth'),  1000),
  ((SELECT id FROM plans WHERE slug='scale'),   1500);

-- Entitlements
-- Free
INSERT INTO plan_entitlements (plan_id, key, value_type, limit_value, usage_reset) VALUES
  ((SELECT id FROM plans WHERE slug='free'), 'locations',         'LIMIT',   1,  'never'),
  ((SELECT id FROM plans WHERE slug='free'), 'published_replies', 'LIMIT',   7,  'weekly'),
  ((SELECT id FROM plans WHERE slug='free'), 'ai_drafts',         'LIMIT',   14, 'weekly'),
  ((SELECT id FROM plans WHERE slug='free'), 'team_members',      'LIMIT',   1,  'never'),
  ((SELECT id FROM plans WHERE slug='free'), 'brand_brain_profiles','LIMIT', 1,  'never');
INSERT INTO plan_entitlements (plan_id, key, value_type, enum_value, usage_reset) VALUES
  ((SELECT id FROM plans WHERE slug='free'), 'support_tier', 'ENUM', 'help_guides', 'never');

-- Starter
INSERT INTO plan_entitlements (plan_id, key, value_type, limit_value, usage_reset) VALUES
  ((SELECT id FROM plans WHERE slug='starter'), 'locations',         'LIMIT', 1,   'never'),
  ((SELECT id FROM plans WHERE slug='starter'), 'published_replies', 'LIMIT', 100, 'monthly'),
  ((SELECT id FROM plans WHERE slug='starter'), 'ai_drafts',         'LIMIT', 200, 'monthly'),
  ((SELECT id FROM plans WHERE slug='starter'), 'team_members',      'LIMIT', 2,   'never'),
  ((SELECT id FROM plans WHERE slug='starter'), 'brand_brain_profiles','LIMIT',2,  'never');
INSERT INTO plan_entitlements (plan_id, key, value_type, enum_value, usage_reset) VALUES
  ((SELECT id FROM plans WHERE slug='starter'), 'support_tier', 'ENUM', 'standard_email', 'never');

-- Growth
INSERT INTO plan_entitlements (plan_id, key, value_type, limit_value, usage_reset) VALUES
  ((SELECT id FROM plans WHERE slug='growth'), 'locations',         'LIMIT', 3,   'never'),
  ((SELECT id FROM plans WHERE slug='growth'), 'published_replies', 'LIMIT', 300, 'monthly'),
  ((SELECT id FROM plans WHERE slug='growth'), 'ai_drafts',         'LIMIT', 600, 'monthly'),
  ((SELECT id FROM plans WHERE slug='growth'), 'team_members',      'LIMIT', 5,   'never'),
  ((SELECT id FROM plans WHERE slug='growth'), 'brand_brain_profiles','LIMIT',3,  'never');
INSERT INTO plan_entitlements (plan_id, key, value_type, enum_value, usage_reset) VALUES
  ((SELECT id FROM plans WHERE slug='growth'), 'support_tier', 'ENUM', 'priority_email', 'never');

-- Scale
INSERT INTO plan_entitlements (plan_id, key, value_type, limit_value, usage_reset) VALUES
  ((SELECT id FROM plans WHERE slug='scale'), 'locations',         'LIMIT', 10,   'never'),
  ((SELECT id FROM plans WHERE slug='scale'), 'team_members',      'LIMIT', 10,   'never'),
  ((SELECT id FROM plans WHERE slug='scale'), 'published_replies', 'LIMIT', 1000, 'monthly'),
  ((SELECT id FROM plans WHERE slug='scale'), 'ai_drafts',         'LIMIT', 2000, 'monthly');
INSERT INTO plan_entitlements (plan_id, key, value_type, bool_value, usage_reset) VALUES
  ((SELECT id FROM plans WHERE slug='scale'), 'brand_brain_profiles', 'UNLIMITED', true, 'never');
INSERT INTO plan_entitlements (plan_id, key, value_type, enum_value, usage_reset) VALUES
  ((SELECT id FROM plans WHERE slug='scale'), 'support_tier', 'ENUM', 'priority_email', 'never');

-- ─── Function: auto-assign free plan on first auth ──────────────────────────

CREATE OR REPLACE FUNCTION assign_free_plan()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO subscriptions (user_id, plan_id, billing_interval, current_period_start, current_period_end)
  SELECT NEW.id, p.id, NULL, now(), now() + interval '100 years'
  FROM plans p WHERE p.slug = 'free'
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_billing
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION assign_free_plan();
