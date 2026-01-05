-- Update call_appointments UPDATE policy to include manager
DROP POLICY IF EXISTS "Sales reps and admins can update appointments" ON call_appointments;

CREATE POLICY "Sales reps, managers and admins can update appointments" 
ON call_appointments FOR UPDATE 
TO authenticated 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'sales_rep'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role)
);

-- Update call_appointments INSERT policy to include manager
DROP POLICY IF EXISTS "Sales reps and admins can create appointments" ON call_appointments;

CREATE POLICY "Sales reps, managers and admins can create appointments" 
ON call_appointments FOR INSERT 
TO authenticated 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'sales_rep'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role)
);

-- Update emi_payments UPDATE policy to include manager
DROP POLICY IF EXISTS "Sales reps and admins can update EMI payments" ON emi_payments;

CREATE POLICY "Sales reps, managers and admins can update EMI payments" 
ON emi_payments FOR UPDATE 
TO authenticated 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'sales_rep'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role)
);