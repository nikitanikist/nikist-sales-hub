-- Fix infinite recursion in organization_members RLS policy
-- The current policy queries organization_members within itself, causing recursion
-- Solution: Use the security definer function get_user_organizations() instead

DROP POLICY IF EXISTS "Users can view members of their org" ON public.organization_members;

CREATE POLICY "Users can view members of their org" 
ON public.organization_members 
FOR SELECT 
USING (
  organization_id = ANY(public.get_user_organizations(auth.uid()))
  OR public.is_super_admin(auth.uid())
);