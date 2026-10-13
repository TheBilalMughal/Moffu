-- Migration: 013 — Shared sequential display IDs + profile email/phone/status sync
-- Purpose: Single integer counter (1001+) shared by profiles and organizations for
--          human-readable URLs (/team/1002, /organizations/1003).
--          Also adds email + phone to profiles, syncs status on email confirmation.

-- ── 1. Global display_id sequence ────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.display_id_seq
  START WITH 1001
  INCREMENT BY 1
  NO CYCLE;

-- ── 2. profiles: add display_id, email, phone ────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_id bigint UNIQUE DEFAULT nextval('public.display_id_seq'),
  ADD COLUMN IF NOT EXISTS email      citext,
  ADD COLUMN IF NOT EXISTS phone      text;

-- Backfill email from auth.users for existing profiles
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_display_id ON public.profiles(display_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email      ON public.profiles(email) WHERE deleted_at IS NULL;

-- ── 3. organizations: add display_id ─────────────────────────────────────────

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS display_id bigint UNIQUE DEFAULT nextval('public.display_id_seq');

CREATE INDEX IF NOT EXISTS idx_organizations_display_id ON public.organizations(display_id);

-- ── 4. Update handle_new_user to set email from auth metadata ─────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- ── 5. Trigger: set profile status='active' when email is confirmed ───────────

CREATE OR REPLACE FUNCTION public.handle_user_email_confirmed()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    UPDATE public.profiles
    SET status = 'active', updated_at = now()
    WHERE id = NEW.id AND status = 'pending_verification';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_email_confirmed();

-- ── 6. RLS: platform admins can update profiles (name/phone edits) ────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_update_by_admin'
  ) THEN
    CREATE POLICY "profiles_update_by_admin"
      ON public.profiles FOR UPDATE TO authenticated
      USING (public.get_platform_role() IN ('super_admin', 'admin'));
  END IF;
END$$;

-- ── 7. RLS: platform admins can delete platform_members ──────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'platform_members' AND policyname = 'platform_members_delete_by_admin'
  ) THEN
    CREATE POLICY "platform_members_delete_by_admin"
      ON public.platform_members FOR DELETE TO authenticated
      USING (public.get_platform_role() IN ('super_admin', 'admin'));
  END IF;
END$$;
