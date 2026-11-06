-- Fix platform_members RLS: add owner to INSERT and UPDATE policies, add DELETE policy

-- INSERT: owner + super_admin + admin can add new members
DROP POLICY IF EXISTS platform_members_insert_by_admin ON platform_members;
CREATE POLICY platform_members_insert_by_admin ON platform_members
  FOR INSERT
  WITH CHECK (get_platform_role() = ANY (ARRAY['owner', 'super_admin', 'admin']));

-- UPDATE: owner + super_admin + admin can edit members
DROP POLICY IF EXISTS platform_members_update_by_admin ON platform_members;
CREATE POLICY platform_members_update_by_admin ON platform_members
  FOR UPDATE
  USING (get_platform_role() = ANY (ARRAY['owner', 'super_admin', 'admin']));

-- DELETE: owner + super_admin can delete members (not admin)
CREATE POLICY platform_members_delete_by_superadmin ON platform_members
  FOR DELETE
  USING (get_platform_role() = ANY (ARRAY['owner', 'super_admin']));
