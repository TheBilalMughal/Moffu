-- ─────────────────────────────────────────────────────────────────────────────
-- Admin Notifications
-- Events: new client signup, subscription change/cancelled, google connect/disconnect
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.admin_notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type          text NOT NULL,          -- 'new_client' | 'subscription_changed' | 'subscription_cancelled' | 'google_connected' | 'google_disconnected'
  title         text NOT NULL,
  body          text NOT NULL,
  metadata      jsonb NOT NULL DEFAULT '{}',
  is_read       boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Platform members can read all notifications
CREATE POLICY "platform_members_read_notifications"
  ON public.admin_notifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Only the service role (triggers) inserts; no authenticated user insert allowed
CREATE POLICY "service_role_insert_notifications"
  ON public.admin_notifications FOR INSERT
  TO authenticated
  WITH CHECK (false);  -- blocked for regular auth; service role bypasses RLS

-- Platform members can mark notifications read
CREATE POLICY "platform_members_update_notifications"
  ON public.admin_notifications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Enable Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: lookup org name via user_id → org_members → organizations
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_org_name_by_user(p_user_id uuid)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT o.name
  FROM public.org_members om
  JOIN public.organizations o ON o.id = om.org_id
  WHERE om.user_id = p_user_id
  ORDER BY om.joined_at ASC
  LIMIT 1;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger 1: New client signup (organizations INSERT)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_new_client()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.admin_notifications (type, title, body, metadata)
  VALUES (
    'new_client',
    'New client signed up',
    NEW.name || ' has joined Moffu.',
    jsonb_build_object('org_id', NEW.id, 'org_name', NEW.name, 'ref_id', NEW.ref_id)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_client
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_client();

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger 2: Subscription changed / cancelled (subscriptions UPDATE)
-- ─────────────────────────────────────────────────────────────────────────────
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

  -- Subscription cancelled
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
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
  IF NEW.status = 'active' AND OLD.status IN ('cancelled', 'past_due', 'paused') THEN
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

CREATE TRIGGER trg_notify_subscription_change
  AFTER UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.notify_subscription_change();

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger 3: Google connected (google_connections INSERT / state → 'connected')
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_google_connected()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_name text;
BEGIN
  -- Only when state becomes 'connected'
  IF NEW.state != 'connected' THEN RETURN NEW; END IF;
  -- On UPDATE, only if it just became connected
  IF TG_OP = 'UPDATE' AND OLD.state = 'connected' THEN RETURN NEW; END IF;

  v_org_name := public.get_org_name_by_user(NEW.user_id);
  IF v_org_name IS NULL THEN v_org_name := NEW.google_email; END IF;

  INSERT INTO public.admin_notifications (type, title, body, metadata)
  VALUES (
    'google_connected',
    'Google Business connected',
    v_org_name || ' connected Google account ' || coalesce(NEW.google_email, '') || '.',
    jsonb_build_object('user_id', NEW.user_id, 'org_name', v_org_name, 'google_email', NEW.google_email, 'google_account_id', NEW.google_account_id)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_google_connected_insert
  AFTER INSERT ON public.google_connections
  FOR EACH ROW EXECUTE FUNCTION public.notify_google_connected();

CREATE TRIGGER trg_notify_google_connected_update
  AFTER UPDATE ON public.google_connections
  FOR EACH ROW EXECUTE FUNCTION public.notify_google_connected();

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger 4: Google disconnected (google_connections DELETE)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_google_disconnected()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_name text;
BEGIN
  v_org_name := public.get_org_name_by_user(OLD.user_id);
  IF v_org_name IS NULL THEN v_org_name := OLD.google_email; END IF;

  INSERT INTO public.admin_notifications (type, title, body, metadata)
  VALUES (
    'google_disconnected',
    'Google Business disconnected',
    v_org_name || ' disconnected their Google account.',
    jsonb_build_object('user_id', OLD.user_id, 'org_name', v_org_name, 'google_email', OLD.google_email)
  );
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_notify_google_disconnected
  AFTER DELETE ON public.google_connections
  FOR EACH ROW EXECUTE FUNCTION public.notify_google_disconnected();
