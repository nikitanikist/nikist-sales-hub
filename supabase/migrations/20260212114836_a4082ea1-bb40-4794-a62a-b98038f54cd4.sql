
-- Update SELECT policy: allow sales_rep to see only their own converted students
DROP POLICY "Users can view cohort students in their organization" ON public.cohort_students;
CREATE POLICY "Users can view cohort students in their organization"
ON public.cohort_students
FOR SELECT
TO authenticated
USING (
  (
    organization_id = ANY (get_user_organization_ids())
    AND (
      has_org_role(auth.uid(), 'admin'::app_role)
      OR has_org_role(auth.uid(), 'manager'::app_role)
      OR (has_org_role(auth.uid(), 'sales_rep'::app_role) AND closer_id = auth.uid())
    )
  )
  OR is_super_admin(auth.uid())
);

-- Update INSERT policy: allow sales_rep to insert
DROP POLICY "Users can insert cohort students in their organization" ON public.cohort_students;
CREATE POLICY "Users can insert cohort students in their organization"
ON public.cohort_students
FOR INSERT
TO authenticated
WITH CHECK (
  (
    organization_id = ANY (get_user_organization_ids())
    AND (
      has_org_role(auth.uid(), 'admin'::app_role)
      OR has_org_role(auth.uid(), 'manager'::app_role)
      OR has_org_role(auth.uid(), 'sales_rep'::app_role)
    )
  )
  OR is_super_admin(auth.uid())
);

-- Update UPDATE policy: allow sales_rep to update their own students
DROP POLICY "Users can update cohort students in their organization" ON public.cohort_students;
CREATE POLICY "Users can update cohort students in their organization"
ON public.cohort_students
FOR UPDATE
TO authenticated
USING (
  (
    organization_id = ANY (get_user_organization_ids())
    AND (
      has_org_role(auth.uid(), 'admin'::app_role)
      OR has_org_role(auth.uid(), 'manager'::app_role)
      OR (has_org_role(auth.uid(), 'sales_rep'::app_role) AND closer_id = auth.uid())
    )
  )
  OR is_super_admin(auth.uid())
);
