-- Migration: 015 — Role permission audit trail
-- Stores who granted/revoked which permission on which role

CREATE TABLE IF NOT EXISTS public.role_permission_audit (
  id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role        text        NOT NULL,
  permission  text        NOT NULL,
  action      text        NOT NULL CHECK (action IN ('grant', 'revoke')),
  changed_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rpa_role ON public.role_permission_audit (role, changed_at DESC);
CREATE INDEX idx_rpa_changed_by ON public.role_permission_audit (changed_by);

ALTER TABLE public.role_permission_audit ENABLE ROW LEVEL SECURITY;

-- Platform members can read audit entries
CREATE POLICY "platform_members_read_rpa"
  ON public.role_permission_audit FOR SELECT
  USING (public.is_platform_member());

-- Only super_admin / admin can write
CREATE POLICY "platform_admins_insert_rpa"
  ON public.role_permission_audit FOR INSERT
  WITH CHECK (public.get_platform_role() IN ('super_admin', 'admin'));

-- RLS for user_permission_overrides — platform admins can read all overrides
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'user_permission_overrides'
      AND policyname = 'platform_members_read_overrides'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "platform_members_read_overrides"
        ON public.user_permission_overrides FOR SELECT
        USING (public.is_platform_member())
    $policy$;
  END IF;
END;
$$;
