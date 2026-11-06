-- Migration: 048 — Rename member_role.manager → lead; add platform owner role; protect owner
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Rename member_role enum value: manager → lead
ALTER TYPE public.member_role RENAME VALUE 'manager' TO 'lead';

-- 2. Add 'owner' to platform_role enum (highest tier, undeletable)
ALTER TYPE public.platform_role ADD VALUE IF NOT EXISTS 'owner' BEFORE 'super_admin';

-- 3. Replace trigger: protect owners unconditionally; allow promotion super_admin → owner
CREATE OR REPLACE FUNCTION public.check_last_super_admin()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  -- Owners are absolutely protected: no delete, no role change, no deactivation
  IF TG_OP = 'DELETE' AND OLD.role = 'owner' THEN
    RAISE EXCEPTION 'Owner accounts cannot be deleted'
      USING errcode = 'P0001';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.role = 'owner' AND (NEW.role <> 'owner' OR NOT NEW.is_active) THEN
    RAISE EXCEPTION 'Owner accounts cannot be demoted or deactivated'
      USING errcode = 'P0001';
  END IF;

  -- Promote super_admin → owner is a valid promotion, not a demotion — skip last-SA check
  -- Block removing/demoting the last super_admin in all other cases
  IF (TG_OP = 'UPDATE' AND OLD.role = 'super_admin'
      AND NEW.role <> 'owner'
      AND (NEW.role <> 'super_admin' OR NOT NEW.is_active)) OR
     (TG_OP = 'DELETE' AND OLD.role = 'super_admin') THEN
    SELECT COUNT(*) INTO v_count
    FROM   public.platform_members
    WHERE  role = 'super_admin' AND is_active = true AND id <> OLD.id;

    IF v_count = 0 THEN
      RAISE EXCEPTION 'Cannot remove or demote the last Super Admin'
        USING errcode = 'P0001';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
