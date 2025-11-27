-- Drop existing restrictive policies on funnels
DROP POLICY IF EXISTS "Users can view all funnels" ON funnels;
DROP POLICY IF EXISTS "Sales reps and admins can create funnels" ON funnels;
DROP POLICY IF EXISTS "Sales reps and admins can update funnels" ON funnels;
DROP POLICY IF EXISTS "Only admins can delete funnels" ON funnels;

-- Recreate as PERMISSIVE policies (default behavior)
CREATE POLICY "Users can view all funnels"
  ON funnels FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Sales reps and admins can create funnels"
  ON funnels FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales_rep'::app_role));

CREATE POLICY "Sales reps and admins can update funnels"
  ON funnels FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales_rep'::app_role));

CREATE POLICY "Only admins can delete funnels"
  ON funnels FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));