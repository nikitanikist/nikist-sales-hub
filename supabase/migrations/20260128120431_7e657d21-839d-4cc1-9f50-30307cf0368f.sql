-- Update RLS policy for organization_members to include WITH CHECK clause for INSERT
DROP POLICY IF EXISTS "Super admins can manage org members" ON public.organization_members;
CREATE POLICY "Super admins can manage org members" 
ON public.organization_members 
FOR ALL 
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));