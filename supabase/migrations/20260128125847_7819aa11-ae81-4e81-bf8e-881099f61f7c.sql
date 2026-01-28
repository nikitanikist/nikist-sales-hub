-- Phase 1: Fix Critical Security Issues

-- 1.1 Fix Profiles Table RLS - Make org-scoped
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;

CREATE POLICY "Users can view profiles in their organizations"
ON profiles FOR SELECT
USING (
  id = auth.uid()  -- Always see own profile
  OR id IN (
    SELECT om2.user_id 
    FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid()
  )
  OR is_super_admin(auth.uid())
);

-- 1.2 Fix customer_onboarding - Remove unauthenticated insert policy
DROP POLICY IF EXISTS "Anyone can create onboarding records" ON customer_onboarding;

CREATE POLICY "Users can create onboarding in their organization"
ON customer_onboarding FOR INSERT
WITH CHECK (
  organization_id = ANY(get_user_organization_ids())
  OR is_super_admin(auth.uid())
);

-- 1.3 Fix leads table - Remove unauthenticated insert (was allowing auth.uid() IS NULL)
DROP POLICY IF EXISTS "Users can create leads in their organization" ON leads;

CREATE POLICY "Users can create leads in their organization"
ON leads FOR INSERT
WITH CHECK (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'sales_rep')))
  OR is_super_admin(auth.uid())
);

-- 1.4 Fix lead_assignments table - Remove unauthenticated insert
DROP POLICY IF EXISTS "Users can create assignments in their organization" ON lead_assignments;

CREATE POLICY "Users can create assignments in their organization"
ON lead_assignments FOR INSERT
WITH CHECK (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'sales_rep')))
  OR is_super_admin(auth.uid())
);

-- 1.5 Fix call_appointments table - Remove unauthenticated insert
DROP POLICY IF EXISTS "Users can create appointments in their organization" ON call_appointments;

CREATE POLICY "Users can create appointments in their organization"
ON call_appointments FOR INSERT
WITH CHECK (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'sales_rep') OR has_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

-- 1.6 Fix user_permissions to be org-aware
-- First, check that organization context is respected for permissions

-- 1.7 Add organization_id to user_permissions if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_permissions' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE user_permissions ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
END $$;

-- Update user_permissions policies
DROP POLICY IF EXISTS "Admins can view all permissions" ON user_permissions;
DROP POLICY IF EXISTS "Admins can insert permissions" ON user_permissions;
DROP POLICY IF EXISTS "Admins can update permissions" ON user_permissions;
DROP POLICY IF EXISTS "Admins can delete permissions" ON user_permissions;
DROP POLICY IF EXISTS "Users can view own permissions" ON user_permissions;

-- Users can see their own permissions
CREATE POLICY "Users can view own permissions"
ON user_permissions FOR SELECT
USING (auth.uid() = user_id);

-- Org admins can manage permissions for their org members
CREATE POLICY "Org admins can view org member permissions"
ON user_permissions FOR SELECT
USING (
  user_id IN (
    SELECT om2.user_id 
    FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid() AND om1.is_org_admin = true
  )
  OR has_role(auth.uid(), 'admin')
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Org admins can insert org member permissions"
ON user_permissions FOR INSERT
WITH CHECK (
  user_id IN (
    SELECT om2.user_id 
    FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid() AND om1.is_org_admin = true
  )
  OR has_role(auth.uid(), 'admin')
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Org admins can update org member permissions"
ON user_permissions FOR UPDATE
USING (
  user_id IN (
    SELECT om2.user_id 
    FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid() AND om1.is_org_admin = true
  )
  OR has_role(auth.uid(), 'admin')
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Org admins can delete org member permissions"
ON user_permissions FOR DELETE
USING (
  user_id IN (
    SELECT om2.user_id 
    FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid() AND om1.is_org_admin = true
  )
  OR has_role(auth.uid(), 'admin')
  OR is_super_admin(auth.uid())
);