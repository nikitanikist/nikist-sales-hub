-- Allow organization admins to update their own organization settings
CREATE POLICY "Org admins can update their organization"
ON public.organizations
FOR UPDATE
USING (
  is_org_admin(auth.uid(), id) 
  OR is_super_admin(auth.uid())
);