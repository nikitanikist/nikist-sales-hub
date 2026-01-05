-- Drop existing INSERT policy and create a more permissive one
DROP POLICY IF EXISTS "Sales reps and admins can insert EMI payments" ON emi_payments;

CREATE POLICY "Authenticated users can insert EMI payments" 
ON emi_payments FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM call_appointments ca
    WHERE ca.id = appointment_id
  )
);