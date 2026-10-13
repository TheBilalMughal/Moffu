-- Fix: assign_free_plan trigger was missing `status` value
-- subscriptions.status is NOT NULL, causing "Database error saving new user"

CREATE OR REPLACE FUNCTION public.assign_free_plan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO subscriptions (user_id, plan_id, status, billing_interval, current_period_start, current_period_end)
  SELECT NEW.id, p.id, 'active', NULL, now(), now() + interval '100 years'
  FROM plans p WHERE p.slug = 'free'
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
