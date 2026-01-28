-- Create helper function to get user's organization IDs
CREATE OR REPLACE FUNCTION public.get_user_organization_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    ARRAY_AGG(organization_id),
    '{}'::uuid[]
  )
  FROM organization_members
  WHERE user_id = auth.uid()
$$;

-- =============================================
-- LEADS TABLE - Update RLS policies
-- =============================================
DROP POLICY IF EXISTS "Users can view all leads" ON leads;
CREATE POLICY "Users can view leads in their organization"
ON leads FOR SELECT
USING (
  organization_id = ANY(get_user_organization_ids())
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Sales reps and admins can create leads" ON leads;
CREATE POLICY "Users can create leads in their organization"
ON leads FOR INSERT
WITH CHECK (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'sales_rep')))
  OR is_super_admin(auth.uid())
  OR auth.uid() IS NULL
);

DROP POLICY IF EXISTS "Sales reps and admins can update leads" ON leads;
CREATE POLICY "Users can update leads in their organization"
ON leads FOR UPDATE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'sales_rep')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Only admins can delete leads" ON leads;
CREATE POLICY "Admins can delete leads in their organization"
ON leads FOR DELETE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND has_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- =============================================
-- LEAD_ASSIGNMENTS TABLE - Update RLS policies
-- =============================================
DROP POLICY IF EXISTS "Users can view all assignments" ON lead_assignments;
CREATE POLICY "Users can view assignments in their organization"
ON lead_assignments FOR SELECT
USING (
  organization_id = ANY(get_user_organization_ids())
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Anyone can create assignments" ON lead_assignments;
CREATE POLICY "Users can create assignments in their organization"
ON lead_assignments FOR INSERT
WITH CHECK (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'sales_rep')))
  OR is_super_admin(auth.uid())
  OR auth.uid() IS NULL
);

DROP POLICY IF EXISTS "Sales reps and admins can update assignments" ON lead_assignments;
CREATE POLICY "Users can update assignments in their organization"
ON lead_assignments FOR UPDATE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'sales_rep')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Sales reps and admins can delete assignments" ON lead_assignments;
CREATE POLICY "Users can delete assignments in their organization"
ON lead_assignments FOR DELETE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'sales_rep')))
  OR is_super_admin(auth.uid())
);

-- =============================================
-- WORKSHOPS TABLE - Update RLS policies
-- =============================================
DROP POLICY IF EXISTS "Users can view all workshops" ON workshops;
CREATE POLICY "Users can view workshops in their organization"
ON workshops FOR SELECT
USING (
  organization_id = ANY(get_user_organization_ids())
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Sales reps and admins can create workshops" ON workshops;
CREATE POLICY "Users can create workshops in their organization"
ON workshops FOR INSERT
WITH CHECK (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'sales_rep')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Sales reps and admins can update workshops" ON workshops;
CREATE POLICY "Users can update workshops in their organization"
ON workshops FOR UPDATE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'sales_rep')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Only admins can delete workshops" ON workshops;
CREATE POLICY "Admins can delete workshops in their organization"
ON workshops FOR DELETE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND has_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- =============================================
-- PRODUCTS TABLE - Update RLS policies
-- =============================================
DROP POLICY IF EXISTS "Users can view all products" ON products;
CREATE POLICY "Users can view products in their organization"
ON products FOR SELECT
USING (
  organization_id = ANY(get_user_organization_ids())
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Sales reps and admins can create products" ON products;
CREATE POLICY "Users can create products in their organization"
ON products FOR INSERT
WITH CHECK (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'sales_rep')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Sales reps and admins can update products" ON products;
CREATE POLICY "Users can update products in their organization"
ON products FOR UPDATE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'sales_rep')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Only admins can delete products" ON products;
CREATE POLICY "Admins can delete products in their organization"
ON products FOR DELETE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND has_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- =============================================
-- FUNNELS TABLE - Update RLS policies (if exists)
-- =============================================
DROP POLICY IF EXISTS "Users can view all funnels" ON funnels;
CREATE POLICY "Users can view funnels in their organization"
ON funnels FOR SELECT
USING (
  organization_id = ANY(get_user_organization_ids())
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Sales reps and admins can create funnels" ON funnels;
CREATE POLICY "Users can create funnels in their organization"
ON funnels FOR INSERT
WITH CHECK (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'sales_rep')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Sales reps and admins can update funnels" ON funnels;
CREATE POLICY "Users can update funnels in their organization"
ON funnels FOR UPDATE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'sales_rep')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Only admins can delete funnels" ON funnels;
CREATE POLICY "Admins can delete funnels in their organization"
ON funnels FOR DELETE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND has_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- =============================================
-- SALES TABLE - Update RLS policies
-- =============================================
DROP POLICY IF EXISTS "Users can view all sales" ON sales;
CREATE POLICY "Users can view sales in their organization"
ON sales FOR SELECT
USING (
  organization_id = ANY(get_user_organization_ids())
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Sales reps and admins can create sales" ON sales;
CREATE POLICY "Users can create sales in their organization"
ON sales FOR INSERT
WITH CHECK (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'sales_rep')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Sales reps and admins can update sales" ON sales;
CREATE POLICY "Users can update sales in their organization"
ON sales FOR UPDATE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'sales_rep')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Only admins can delete sales" ON sales;
CREATE POLICY "Admins can delete sales in their organization"
ON sales FOR DELETE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND has_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- =============================================
-- CALL_APPOINTMENTS TABLE - Update RLS policies
-- =============================================
DROP POLICY IF EXISTS "Users can view all appointments" ON call_appointments;
CREATE POLICY "Users can view appointments in their organization"
ON call_appointments FOR SELECT
USING (
  organization_id = ANY(get_user_organization_ids())
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Sales reps, managers and admins can create appointments" ON call_appointments;
CREATE POLICY "Users can create appointments in their organization"
ON call_appointments FOR INSERT
WITH CHECK (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'sales_rep') OR has_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
  OR auth.uid() IS NULL
);

DROP POLICY IF EXISTS "Sales reps, managers and admins can update appointments" ON call_appointments;
CREATE POLICY "Users can update appointments in their organization"
ON call_appointments FOR UPDATE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'sales_rep') OR has_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Only admins can delete appointments" ON call_appointments;
CREATE POLICY "Admins can delete appointments in their organization"
ON call_appointments FOR DELETE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND has_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- =============================================
-- BATCHES TABLE - Update RLS policies
-- =============================================
DROP POLICY IF EXISTS "Anyone authenticated can view batches" ON batches;
CREATE POLICY "Users can view batches in their organization"
ON batches FOR SELECT
USING (
  organization_id = ANY(get_user_organization_ids())
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can create batches" ON batches;
CREATE POLICY "Admins can create batches in their organization"
ON batches FOR INSERT
WITH CHECK (
  (organization_id = ANY(get_user_organization_ids()) 
   AND has_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can update batches" ON batches;
CREATE POLICY "Admins can update batches in their organization"
ON batches FOR UPDATE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND has_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete batches" ON batches;
CREATE POLICY "Admins can delete batches in their organization"
ON batches FOR DELETE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND has_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- =============================================
-- DAILY_MONEY_FLOW TABLE - Update RLS policies
-- =============================================
DROP POLICY IF EXISTS "Admins and managers can view daily money flow" ON daily_money_flow;
CREATE POLICY "Users can view daily money flow in their organization"
ON daily_money_flow FOR SELECT
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins and managers can insert daily money flow" ON daily_money_flow;
CREATE POLICY "Users can insert daily money flow in their organization"
ON daily_money_flow FOR INSERT
WITH CHECK (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins and managers can update daily money flow" ON daily_money_flow;
CREATE POLICY "Users can update daily money flow in their organization"
ON daily_money_flow FOR UPDATE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete daily money flow" ON daily_money_flow;
CREATE POLICY "Admins can delete daily money flow in their organization"
ON daily_money_flow FOR DELETE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND has_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- =============================================
-- EMI_PAYMENTS TABLE - Update RLS policies
-- =============================================
DROP POLICY IF EXISTS "Users can view EMI payments" ON emi_payments;
CREATE POLICY "Users can view EMI payments in their organization"
ON emi_payments FOR SELECT
USING (
  organization_id = ANY(get_user_organization_ids())
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Authenticated users can insert EMI payments" ON emi_payments;
CREATE POLICY "Users can insert EMI payments in their organization"
ON emi_payments FOR INSERT
WITH CHECK (
  organization_id = ANY(get_user_organization_ids())
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Sales reps, managers and admins can update EMI payments" ON emi_payments;
CREATE POLICY "Users can update EMI payments in their organization"
ON emi_payments FOR UPDATE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'sales_rep') OR has_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete EMI payments" ON emi_payments;
CREATE POLICY "Admins can delete EMI payments in their organization"
ON emi_payments FOR DELETE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND has_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- =============================================
-- CALL_REMINDERS TABLE - Update RLS policies
-- =============================================
DROP POLICY IF EXISTS "Users can view all reminders" ON call_reminders;
CREATE POLICY "Users can view reminders in their organization"
ON call_reminders FOR SELECT
USING (
  organization_id = ANY(get_user_organization_ids())
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Sales reps and admins can manage reminders" ON call_reminders;
CREATE POLICY "Users can manage reminders in their organization"
ON call_reminders FOR ALL
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'sales_rep')))
  OR is_super_admin(auth.uid())
);

-- =============================================
-- FUTURES_MENTORSHIP_BATCHES TABLE - Update RLS policies
-- =============================================
DROP POLICY IF EXISTS "Admins and managers can view futures batches" ON futures_mentorship_batches;
CREATE POLICY "Users can view futures batches in their organization"
ON futures_mentorship_batches FOR SELECT
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can insert futures batches" ON futures_mentorship_batches;
CREATE POLICY "Admins can insert futures batches in their organization"
ON futures_mentorship_batches FOR INSERT
WITH CHECK (
  (organization_id = ANY(get_user_organization_ids()) 
   AND has_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can update futures batches" ON futures_mentorship_batches;
CREATE POLICY "Admins can update futures batches in their organization"
ON futures_mentorship_batches FOR UPDATE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND has_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete futures batches" ON futures_mentorship_batches;
CREATE POLICY "Admins can delete futures batches in their organization"
ON futures_mentorship_batches FOR DELETE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND has_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- =============================================
-- FUTURES_MENTORSHIP_STUDENTS TABLE - Update RLS policies
-- =============================================
DROP POLICY IF EXISTS "Admins and managers can view futures students" ON futures_mentorship_students;
CREATE POLICY "Users can view futures students in their organization"
ON futures_mentorship_students FOR SELECT
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins and managers can insert futures students" ON futures_mentorship_students;
CREATE POLICY "Users can insert futures students in their organization"
ON futures_mentorship_students FOR INSERT
WITH CHECK (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins and managers can update futures students" ON futures_mentorship_students;
CREATE POLICY "Users can update futures students in their organization"
ON futures_mentorship_students FOR UPDATE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete futures students" ON futures_mentorship_students;
CREATE POLICY "Admins can delete futures students in their organization"
ON futures_mentorship_students FOR DELETE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND has_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- =============================================
-- HIGH_FUTURE_BATCHES TABLE - Update RLS policies
-- =============================================
DROP POLICY IF EXISTS "Admins and managers can view high future batches" ON high_future_batches;
CREATE POLICY "Users can view high future batches in their organization"
ON high_future_batches FOR SELECT
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can insert high future batches" ON high_future_batches;
CREATE POLICY "Admins can insert high future batches in their organization"
ON high_future_batches FOR INSERT
WITH CHECK (
  (organization_id = ANY(get_user_organization_ids()) 
   AND has_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can update high future batches" ON high_future_batches;
CREATE POLICY "Admins can update high future batches in their organization"
ON high_future_batches FOR UPDATE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND has_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete high future batches" ON high_future_batches;
CREATE POLICY "Admins can delete high future batches in their organization"
ON high_future_batches FOR DELETE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND has_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- =============================================
-- HIGH_FUTURE_STUDENTS TABLE - Update RLS policies
-- =============================================
DROP POLICY IF EXISTS "Admins and managers can view high future students" ON high_future_students;
CREATE POLICY "Users can view high future students in their organization"
ON high_future_students FOR SELECT
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins and managers can insert high future students" ON high_future_students;
CREATE POLICY "Users can insert high future students in their organization"
ON high_future_students FOR INSERT
WITH CHECK (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins and managers can update high future students" ON high_future_students;
CREATE POLICY "Users can update high future students in their organization"
ON high_future_students FOR UPDATE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete high future students" ON high_future_students;
CREATE POLICY "Admins can delete high future students in their organization"
ON high_future_students FOR DELETE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND has_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- =============================================
-- OFFER_AMOUNT_HISTORY TABLE - Update RLS policies
-- =============================================
DROP POLICY IF EXISTS "Users can view offer amount history" ON offer_amount_history;
CREATE POLICY "Users can view offer history in their organization"
ON offer_amount_history FOR SELECT
USING (
  organization_id = ANY(get_user_organization_ids())
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Sales reps, managers and admins can insert offer history" ON offer_amount_history;
CREATE POLICY "Users can insert offer history in their organization"
ON offer_amount_history FOR INSERT
WITH CHECK (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'sales_rep') OR has_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

-- =============================================
-- FUTURES_OFFER_AMOUNT_HISTORY TABLE - Update RLS policies
-- =============================================
DROP POLICY IF EXISTS "Admins and managers can view futures offer history" ON futures_offer_amount_history;
CREATE POLICY "Users can view futures offer history in their organization"
ON futures_offer_amount_history FOR SELECT
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins and managers can insert futures offer history" ON futures_offer_amount_history;
CREATE POLICY "Users can insert futures offer history in their organization"
ON futures_offer_amount_history FOR INSERT
WITH CHECK (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

-- =============================================
-- HIGH_FUTURE_OFFER_AMOUNT_HISTORY TABLE - Update RLS policies
-- =============================================
DROP POLICY IF EXISTS "Admins and managers can view high future offer history" ON high_future_offer_amount_history;
CREATE POLICY "Users can view high future offer history in their organization"
ON high_future_offer_amount_history FOR SELECT
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins and managers can insert high future offer history" ON high_future_offer_amount_history;
CREATE POLICY "Users can insert high future offer history in their organization"
ON high_future_offer_amount_history FOR INSERT
WITH CHECK (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

-- =============================================
-- FUTURES_EMI_PAYMENTS TABLE - Update RLS policies
-- =============================================
DROP POLICY IF EXISTS "Admins and managers can view futures EMI" ON futures_emi_payments;
CREATE POLICY "Users can view futures EMI in their organization"
ON futures_emi_payments FOR SELECT
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins and managers can insert futures EMI" ON futures_emi_payments;
CREATE POLICY "Users can insert futures EMI in their organization"
ON futures_emi_payments FOR INSERT
WITH CHECK (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins and managers can update futures EMI" ON futures_emi_payments;
CREATE POLICY "Users can update futures EMI in their organization"
ON futures_emi_payments FOR UPDATE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete futures EMI" ON futures_emi_payments;
CREATE POLICY "Admins can delete futures EMI in their organization"
ON futures_emi_payments FOR DELETE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND has_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- =============================================
-- HIGH_FUTURE_EMI_PAYMENTS TABLE - Update RLS policies
-- =============================================
DROP POLICY IF EXISTS "Admins and managers can view high future EMI" ON high_future_emi_payments;
CREATE POLICY "Users can view high future EMI in their organization"
ON high_future_emi_payments FOR SELECT
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins and managers can insert high future EMI" ON high_future_emi_payments;
CREATE POLICY "Users can insert high future EMI in their organization"
ON high_future_emi_payments FOR INSERT
WITH CHECK (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins and managers can update high future EMI" ON high_future_emi_payments;
CREATE POLICY "Users can update high future EMI in their organization"
ON high_future_emi_payments FOR UPDATE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete high future EMI" ON high_future_emi_payments;
CREATE POLICY "Admins can delete high future EMI in their organization"
ON high_future_emi_payments FOR DELETE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND has_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- =============================================
-- CUSTOMER_ONBOARDING TABLE - Update RLS policies
-- =============================================
DROP POLICY IF EXISTS "Users can view all onboarding records" ON customer_onboarding;
CREATE POLICY "Users can view onboarding in their organization"
ON customer_onboarding FOR SELECT
USING (
  organization_id = ANY(get_user_organization_ids())
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Anyone can create onboarding records" ON customer_onboarding;
CREATE POLICY "Anyone can create onboarding records"
ON customer_onboarding FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Sales reps and admins can update onboarding records" ON customer_onboarding;
CREATE POLICY "Users can update onboarding in their organization"
ON customer_onboarding FOR UPDATE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'sales_rep')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Only admins can delete onboarding records" ON customer_onboarding;
CREATE POLICY "Admins can delete onboarding in their organization"
ON customer_onboarding FOR DELETE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND has_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- =============================================
-- WEBHOOK_INGEST_EVENTS TABLE - Update RLS policies
-- =============================================
DROP POLICY IF EXISTS "Admins and managers can view webhook events" ON webhook_ingest_events;
CREATE POLICY "Users can view webhook events in their organization"
ON webhook_ingest_events FOR SELECT
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);