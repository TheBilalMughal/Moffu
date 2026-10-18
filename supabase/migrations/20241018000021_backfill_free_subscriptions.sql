-- Backfill free plan subscriptions for any auth users who don't have one yet.
-- Covers users created before the assign_free_plan trigger was fixed (migration 012),
-- plus any edge cases where the trigger failed silently.

INSERT INTO public.subscriptions (user_id, plan_id, status, billing_interval, current_period_start, current_period_end)
SELECT
  u.id,
  p.id,
  'active',
  NULL,
  now(),
  now() + interval '100 years'
FROM auth.users u
CROSS JOIN (SELECT id FROM public.plans WHERE slug = 'free') p
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscriptions s WHERE s.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- Fix notification trigger: 'cancelled' (2 l's) → 'canceled' (1 l) to match subscriptions CHECK constraint.
-- The old condition NEW.status = 'cancelled' could never fire since that status value is rejected by the constraint.
CREATE OR REPLACE FUNCTION public.notify_subscription_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_name  text;
  v_old_plan  text;
  v_new_plan  text;
BEGIN
  -- Only fire when something meaningful changed
  IF OLD.status = NEW.status AND OLD.plan_id = NEW.plan_id AND OLD.cancel_at_period_end = NEW.cancel_at_period_end THEN
    RETURN NEW;
  END IF;

  v_org_name := public.get_org_name_by_user(NEW.user_id);
  IF v_org_name IS NULL THEN v_org_name := 'Unknown client'; END IF;

  -- Subscription canceled (correct single-l spelling matching the CHECK constraint)
  IF NEW.status = 'canceled' AND OLD.status != 'canceled' THEN
    INSERT INTO public.admin_notifications (type, title, body, metadata)
    VALUES (
      'subscription_cancelled',
      'Subscription cancelled',
      v_org_name || ' cancelled their subscription.',
      jsonb_build_object('user_id', NEW.user_id, 'org_name', v_org_name, 'plan_id', NEW.plan_id)
    );
    RETURN NEW;
  END IF;

  -- Cancel scheduled at period end toggled on
  IF NEW.cancel_at_period_end = true AND OLD.cancel_at_period_end = false THEN
    INSERT INTO public.admin_notifications (type, title, body, metadata)
    VALUES (
      'subscription_cancelled',
      'Subscription set to cancel',
      v_org_name || ' scheduled cancellation at period end.',
      jsonb_build_object('user_id', NEW.user_id, 'org_name', v_org_name, 'plan_id', NEW.plan_id)
    );
    RETURN NEW;
  END IF;

  -- Plan changed
  IF OLD.plan_id IS DISTINCT FROM NEW.plan_id THEN
    SELECT name INTO v_old_plan FROM public.plans WHERE id = OLD.plan_id;
    SELECT name INTO v_new_plan FROM public.plans WHERE id = NEW.plan_id;
    INSERT INTO public.admin_notifications (type, title, body, metadata)
    VALUES (
      'subscription_changed',
      'Subscription plan changed',
      v_org_name || ' changed plan from ' || coalesce(v_old_plan, '?') || ' to ' || coalesce(v_new_plan, '?') || '.',
      jsonb_build_object('user_id', NEW.user_id, 'org_name', v_org_name, 'old_plan', v_old_plan, 'new_plan', v_new_plan)
    );
    RETURN NEW;
  END IF;

  -- Status reactivated
  IF NEW.status = 'active' AND OLD.status IN ('canceled', 'past_due', 'paused') THEN
    SELECT name INTO v_new_plan FROM public.plans WHERE id = NEW.plan_id;
    INSERT INTO public.admin_notifications (type, title, body, metadata)
    VALUES (
      'subscription_changed',
      'Subscription reactivated',
      v_org_name || ' reactivated their ' || coalesce(v_new_plan, '') || ' subscription.',
      jsonb_build_object('user_id', NEW.user_id, 'org_name', v_org_name, 'plan_id', NEW.plan_id)
    );
  END IF;

  RETURN NEW;
END;
$$;
