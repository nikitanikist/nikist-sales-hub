-- Step 1: Create the organization-aware role check function
CREATE OR REPLACE FUNCTION public.has_org_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Step 2: Fix Shivani's user_roles record immediately (as fallback)
UPDATE public.user_roles 
SET role = 'admin'
WHERE user_id = '2361e8ab-3703-423f-94e1-aeb00313978d';

-- Step 3: Update RLS policies on all tables to use has_org_role instead of has_role

-- ============ call_appointments ============
DROP POLICY IF EXISTS "Users can create appointments in their organization" ON call_appointments;
CREATE POLICY "Users can create appointments in their organization"
ON call_appointments FOR INSERT TO authenticated
WITH CHECK (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'sales_rep') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can update appointments in their organization" ON call_appointments;
CREATE POLICY "Users can update appointments in their organization"
ON call_appointments FOR UPDATE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'sales_rep') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete appointments in their organization" ON call_appointments;
CREATE POLICY "Admins can delete appointments in their organization"
ON call_appointments FOR DELETE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) AND has_org_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- ============ leads ============
DROP POLICY IF EXISTS "Users can create leads in their organization" ON leads;
CREATE POLICY "Users can create leads in their organization"
ON leads FOR INSERT TO authenticated
WITH CHECK (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'sales_rep')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can update leads in their organization" ON leads;
CREATE POLICY "Users can update leads in their organization"
ON leads FOR UPDATE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'sales_rep')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete leads in their organization" ON leads;
CREATE POLICY "Admins can delete leads in their organization"
ON leads FOR DELETE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) AND has_org_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- ============ lead_assignments ============
DROP POLICY IF EXISTS "Users can create lead assignments in their organization" ON lead_assignments;
CREATE POLICY "Users can create lead assignments in their organization"
ON lead_assignments FOR INSERT TO authenticated
WITH CHECK (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'sales_rep')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can update lead assignments in their organization" ON lead_assignments;
CREATE POLICY "Users can update lead assignments in their organization"
ON lead_assignments FOR UPDATE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'sales_rep')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete lead assignments in their organization" ON lead_assignments;
CREATE POLICY "Admins can delete lead assignments in their organization"
ON lead_assignments FOR DELETE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) AND has_org_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- ============ funnels ============
DROP POLICY IF EXISTS "Users can create funnels in their organization" ON funnels;
CREATE POLICY "Users can create funnels in their organization"
ON funnels FOR INSERT TO authenticated
WITH CHECK (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'sales_rep')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can update funnels in their organization" ON funnels;
CREATE POLICY "Users can update funnels in their organization"
ON funnels FOR UPDATE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'sales_rep')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete funnels in their organization" ON funnels;
CREATE POLICY "Admins can delete funnels in their organization"
ON funnels FOR DELETE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) AND has_org_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- ============ products ============
DROP POLICY IF EXISTS "Users can create products in their organization" ON products;
CREATE POLICY "Users can create products in their organization"
ON products FOR INSERT TO authenticated
WITH CHECK (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'sales_rep')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can update products in their organization" ON products;
CREATE POLICY "Users can update products in their organization"
ON products FOR UPDATE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'sales_rep')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete products in their organization" ON products;
CREATE POLICY "Admins can delete products in their organization"
ON products FOR DELETE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) AND has_org_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- ============ workshops ============
DROP POLICY IF EXISTS "Users can create workshops in their organization" ON workshops;
CREATE POLICY "Users can create workshops in their organization"
ON workshops FOR INSERT TO authenticated
WITH CHECK (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can update workshops in their organization" ON workshops;
CREATE POLICY "Users can update workshops in their organization"
ON workshops FOR UPDATE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete workshops in their organization" ON workshops;
CREATE POLICY "Admins can delete workshops in their organization"
ON workshops FOR DELETE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) AND has_org_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- ============ cohort_students ============
DROP POLICY IF EXISTS "Users can insert cohort students in their organization" ON cohort_students;
CREATE POLICY "Users can insert cohort students in their organization"
ON cohort_students FOR INSERT TO authenticated
WITH CHECK (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can update cohort students in their organization" ON cohort_students;
CREATE POLICY "Users can update cohort students in their organization"
ON cohort_students FOR UPDATE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete cohort students in their organization" ON cohort_students;
CREATE POLICY "Admins can delete cohort students in their organization"
ON cohort_students FOR DELETE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) AND has_org_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can view cohort students in their organization" ON cohort_students;
CREATE POLICY "Users can view cohort students in their organization"
ON cohort_students FOR SELECT TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

-- ============ futures_mentorship_students ============
DROP POLICY IF EXISTS "Users can insert futures students in their organization" ON futures_mentorship_students;
CREATE POLICY "Users can insert futures students in their organization"
ON futures_mentorship_students FOR INSERT TO authenticated
WITH CHECK (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can update futures students in their organization" ON futures_mentorship_students;
CREATE POLICY "Users can update futures students in their organization"
ON futures_mentorship_students FOR UPDATE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete futures students in their organization" ON futures_mentorship_students;
CREATE POLICY "Admins can delete futures students in their organization"
ON futures_mentorship_students FOR DELETE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) AND has_org_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can view futures students in their organization" ON futures_mentorship_students;
CREATE POLICY "Users can view futures students in their organization"
ON futures_mentorship_students FOR SELECT TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

-- ============ high_future_students ============
DROP POLICY IF EXISTS "Users can insert high future students in their organization" ON high_future_students;
CREATE POLICY "Users can insert high future students in their organization"
ON high_future_students FOR INSERT TO authenticated
WITH CHECK (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can update high future students in their organization" ON high_future_students;
CREATE POLICY "Users can update high future students in their organization"
ON high_future_students FOR UPDATE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete high future students in their organization" ON high_future_students;
CREATE POLICY "Admins can delete high future students in their organization"
ON high_future_students FOR DELETE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) AND has_org_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can view high future students in their organization" ON high_future_students;
CREATE POLICY "Users can view high future students in their organization"
ON high_future_students FOR SELECT TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

-- ============ emi_payments ============
DROP POLICY IF EXISTS "Users can insert EMI payments in their organization" ON emi_payments;
CREATE POLICY "Users can insert EMI payments in their organization"
ON emi_payments FOR INSERT TO authenticated
WITH CHECK (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'sales_rep') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can update EMI payments in their organization" ON emi_payments;
CREATE POLICY "Users can update EMI payments in their organization"
ON emi_payments FOR UPDATE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'sales_rep') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete EMI payments in their organization" ON emi_payments;
CREATE POLICY "Admins can delete EMI payments in their organization"
ON emi_payments FOR DELETE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) AND has_org_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- ============ cohort_emi_payments ============
DROP POLICY IF EXISTS "Users can insert cohort EMI in their organization" ON cohort_emi_payments;
CREATE POLICY "Users can insert cohort EMI in their organization"
ON cohort_emi_payments FOR INSERT TO authenticated
WITH CHECK (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can update cohort EMI in their organization" ON cohort_emi_payments;
CREATE POLICY "Users can update cohort EMI in their organization"
ON cohort_emi_payments FOR UPDATE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete cohort EMI in their organization" ON cohort_emi_payments;
CREATE POLICY "Admins can delete cohort EMI in their organization"
ON cohort_emi_payments FOR DELETE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) AND has_org_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can view cohort EMI in their organization" ON cohort_emi_payments;
CREATE POLICY "Users can view cohort EMI in their organization"
ON cohort_emi_payments FOR SELECT TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

-- ============ futures_emi_payments ============
DROP POLICY IF EXISTS "Users can insert futures EMI in their organization" ON futures_emi_payments;
CREATE POLICY "Users can insert futures EMI in their organization"
ON futures_emi_payments FOR INSERT TO authenticated
WITH CHECK (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can update futures EMI in their organization" ON futures_emi_payments;
CREATE POLICY "Users can update futures EMI in their organization"
ON futures_emi_payments FOR UPDATE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete futures EMI in their organization" ON futures_emi_payments;
CREATE POLICY "Admins can delete futures EMI in their organization"
ON futures_emi_payments FOR DELETE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) AND has_org_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can view futures EMI in their organization" ON futures_emi_payments;
CREATE POLICY "Users can view futures EMI in their organization"
ON futures_emi_payments FOR SELECT TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

-- ============ high_future_emi_payments ============
DROP POLICY IF EXISTS "Users can insert high future EMI in their organization" ON high_future_emi_payments;
CREATE POLICY "Users can insert high future EMI in their organization"
ON high_future_emi_payments FOR INSERT TO authenticated
WITH CHECK (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can update high future EMI in their organization" ON high_future_emi_payments;
CREATE POLICY "Users can update high future EMI in their organization"
ON high_future_emi_payments FOR UPDATE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete high future EMI in their organization" ON high_future_emi_payments;
CREATE POLICY "Admins can delete high future EMI in their organization"
ON high_future_emi_payments FOR DELETE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) AND has_org_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can view high future EMI in their organization" ON high_future_emi_payments;
CREATE POLICY "Users can view high future EMI in their organization"
ON high_future_emi_payments FOR SELECT TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

-- ============ daily_money_flow ============
DROP POLICY IF EXISTS "Users can insert daily money flow in their organization" ON daily_money_flow;
CREATE POLICY "Users can insert daily money flow in their organization"
ON daily_money_flow FOR INSERT TO authenticated
WITH CHECK (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can update daily money flow in their organization" ON daily_money_flow;
CREATE POLICY "Users can update daily money flow in their organization"
ON daily_money_flow FOR UPDATE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete daily money flow in their organization" ON daily_money_flow;
CREATE POLICY "Admins can delete daily money flow in their organization"
ON daily_money_flow FOR DELETE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) AND has_org_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can view daily money flow in their organization" ON daily_money_flow;
CREATE POLICY "Users can view daily money flow in their organization"
ON daily_money_flow FOR SELECT TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

-- ============ sales ============
DROP POLICY IF EXISTS "Users can create sales in their organization" ON sales;
CREATE POLICY "Users can create sales in their organization"
ON sales FOR INSERT TO authenticated
WITH CHECK (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'sales_rep') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can update sales in their organization" ON sales;
CREATE POLICY "Users can update sales in their organization"
ON sales FOR UPDATE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'sales_rep') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete sales in their organization" ON sales;
CREATE POLICY "Admins can delete sales in their organization"
ON sales FOR DELETE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) AND has_org_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- ============ workshop_tags ============
DROP POLICY IF EXISTS "Admins can create tags in their organization" ON workshop_tags;
CREATE POLICY "Admins can create tags in their organization"
ON workshop_tags FOR INSERT TO authenticated
WITH CHECK (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can update tags in their organization" ON workshop_tags;
CREATE POLICY "Admins can update tags in their organization"
ON workshop_tags FOR UPDATE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete tags in their organization" ON workshop_tags;
CREATE POLICY "Admins can delete tags in their organization"
ON workshop_tags FOR DELETE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) AND has_org_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- ============ template_sequences ============
DROP POLICY IF EXISTS "Admins can create sequences in their organization" ON template_sequences;
CREATE POLICY "Admins can create sequences in their organization"
ON template_sequences FOR INSERT TO authenticated
WITH CHECK (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can update sequences in their organization" ON template_sequences;
CREATE POLICY "Admins can update sequences in their organization"
ON template_sequences FOR UPDATE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete sequences in their organization" ON template_sequences;
CREATE POLICY "Admins can delete sequences in their organization"
ON template_sequences FOR DELETE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) AND has_org_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- ============ template_sequence_steps ============
DROP POLICY IF EXISTS "Admins can create steps in their sequences" ON template_sequence_steps;
CREATE POLICY "Admins can create steps in their sequences"
ON template_sequence_steps FOR INSERT TO authenticated
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM template_sequences ts
    WHERE ts.id = template_sequence_steps.sequence_id
    AND (ts.organization_id = ANY (get_user_organization_ids()))
    AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager'))
  ))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can update steps in their sequences" ON template_sequence_steps;
CREATE POLICY "Admins can update steps in their sequences"
ON template_sequence_steps FOR UPDATE TO authenticated
USING (
  (EXISTS (
    SELECT 1 FROM template_sequences ts
    WHERE ts.id = template_sequence_steps.sequence_id
    AND (ts.organization_id = ANY (get_user_organization_ids()))
    AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager'))
  ))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete steps in their sequences" ON template_sequence_steps;
CREATE POLICY "Admins can delete steps in their sequences"
ON template_sequence_steps FOR DELETE TO authenticated
USING (
  (EXISTS (
    SELECT 1 FROM template_sequences ts
    WHERE ts.id = template_sequence_steps.sequence_id
    AND (ts.organization_id = ANY (get_user_organization_ids()))
    AND has_org_role(auth.uid(), 'admin')
  ))
  OR is_super_admin(auth.uid())
);

-- ============ offer_amount_history ============
DROP POLICY IF EXISTS "Users can insert offer history in their organization" ON offer_amount_history;
CREATE POLICY "Users can insert offer history in their organization"
ON offer_amount_history FOR INSERT TO authenticated
WITH CHECK (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'sales_rep') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

-- ============ cohort_offer_amount_history ============
DROP POLICY IF EXISTS "Users can insert cohort offer history in their organization" ON cohort_offer_amount_history;
CREATE POLICY "Users can insert cohort offer history in their organization"
ON cohort_offer_amount_history FOR INSERT TO authenticated
WITH CHECK (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can view cohort offer history in their organization" ON cohort_offer_amount_history;
CREATE POLICY "Users can view cohort offer history in their organization"
ON cohort_offer_amount_history FOR SELECT TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

-- ============ futures_offer_amount_history ============
DROP POLICY IF EXISTS "Users can insert futures offer history in their organization" ON futures_offer_amount_history;
CREATE POLICY "Users can insert futures offer history in their organization"
ON futures_offer_amount_history FOR INSERT TO authenticated
WITH CHECK (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can view futures offer history in their organization" ON futures_offer_amount_history;
CREATE POLICY "Users can view futures offer history in their organization"
ON futures_offer_amount_history FOR SELECT TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

-- ============ high_future_offer_amount_history ============
DROP POLICY IF EXISTS "Users can insert high future offer history in their organizatio" ON high_future_offer_amount_history;
CREATE POLICY "Users can insert high future offer history in their organization"
ON high_future_offer_amount_history FOR INSERT TO authenticated
WITH CHECK (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can view high future offer history in their organization" ON high_future_offer_amount_history;
CREATE POLICY "Users can view high future offer history in their organization"
ON high_future_offer_amount_history FOR SELECT TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

-- ============ call_reminders ============
DROP POLICY IF EXISTS "Users can manage reminders in their organization" ON call_reminders;
CREATE POLICY "Users can manage reminders in their organization"
ON call_reminders FOR ALL TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'sales_rep')))
  OR is_super_admin(auth.uid())
);

-- ============ customer_onboarding ============
DROP POLICY IF EXISTS "Users can update onboarding in their organization" ON customer_onboarding;
CREATE POLICY "Users can update onboarding in their organization"
ON customer_onboarding FOR UPDATE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'sales_rep')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete onboarding in their organization" ON customer_onboarding;
CREATE POLICY "Admins can delete onboarding in their organization"
ON customer_onboarding FOR DELETE TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) AND has_org_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- ============ webhook_ingest_events ============
DROP POLICY IF EXISTS "Users can view webhook events in their organization" ON webhook_ingest_events;
CREATE POLICY "Users can view webhook events in their organization"
ON webhook_ingest_events FOR SELECT TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

-- ============ workshop_sequence_variables ============
DROP POLICY IF EXISTS "Admins can manage variables in their org" ON workshop_sequence_variables;
CREATE POLICY "Admins can manage variables in their org"
ON workshop_sequence_variables FOR ALL TO authenticated
USING (
  ((organization_id = ANY (get_user_organization_ids())) 
   AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

-- ============ workshop_whatsapp_groups ============
DROP POLICY IF EXISTS "Admins can manage workshop groups" ON workshop_whatsapp_groups;
CREATE POLICY "Admins can manage workshop groups"
ON workshop_whatsapp_groups FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workshops w
    WHERE w.id = workshop_whatsapp_groups.workshop_id
    AND ((w.organization_id = ANY (get_user_organization_ids())) 
         AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
    OR is_super_admin(auth.uid())
  )
);