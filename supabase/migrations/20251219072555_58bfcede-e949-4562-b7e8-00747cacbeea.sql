-- Drop the existing restrictive policy that only allows admins to delete
DROP POLICY IF EXISTS "Only admins can delete assignments" ON lead_assignments;

-- Create new policy allowing both admins and sales_reps to delete assignments
CREATE POLICY "Sales reps and admins can delete assignments" 
ON lead_assignments 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales_rep'::app_role));