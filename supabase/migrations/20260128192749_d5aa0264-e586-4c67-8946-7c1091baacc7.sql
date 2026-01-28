
-- Phase 1: Database Cleanup & Schema Enhancement

-- 1.1 Delete seeded cohort_types for all organizations EXCEPT Nikist (the original org)
DELETE FROM public.cohort_types 
WHERE organization_id != '00000000-0000-0000-0000-000000000001';

-- 1.2 Create unified cohort_batches table
CREATE TABLE public.cohort_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_type_id UUID NOT NULL REFERENCES public.cohort_types(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE,
  event_dates TEXT,
  is_active BOOLEAN DEFAULT true,
  status TEXT NOT NULL DEFAULT 'planned',
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.3 Create unified cohort_students table
CREATE TABLE public.cohort_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_batch_id UUID NOT NULL REFERENCES public.cohort_batches(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id),
  closer_id UUID REFERENCES public.profiles(id),
  conversion_date DATE NOT NULL DEFAULT CURRENT_DATE,
  offer_amount NUMERIC DEFAULT 0,
  cash_received NUMERIC DEFAULT 0,
  due_amount NUMERIC DEFAULT 0,
  classes_access INTEGER DEFAULT 0,
  no_cost_emi NUMERIC DEFAULT 0,
  gst_fees NUMERIC DEFAULT 0,
  platform_fees NUMERIC DEFAULT 0,
  next_follow_up_date DATE,
  pay_after_earning BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  refund_reason TEXT,
  payment_platform TEXT,
  payment_remarks TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.4 Create unified cohort_emi_payments table
CREATE TABLE public.cohort_emi_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.cohort_students(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  emi_number INTEGER NOT NULL,
  amount NUMERIC NOT NULL,
  payment_date DATE NOT NULL,
  previous_cash_received NUMERIC,
  no_cost_emi NUMERIC DEFAULT 0,
  gst_fees NUMERIC DEFAULT 0,
  platform_fees NUMERIC DEFAULT 0,
  payment_platform TEXT DEFAULT 'UPI (IDFC)',
  remarks TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 1.5 Create cohort_offer_amount_history table
CREATE TABLE public.cohort_offer_amount_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.cohort_students(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  previous_amount NUMERIC NOT NULL,
  new_amount NUMERIC NOT NULL,
  reason TEXT,
  changed_by UUID REFERENCES public.profiles(id),
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.cohort_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohort_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohort_emi_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohort_offer_amount_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cohort_batches
CREATE POLICY "Users can view cohort batches in their organization"
ON public.cohort_batches FOR SELECT
USING ((organization_id = ANY (get_user_organization_ids())) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage cohort batches in their organization"
ON public.cohort_batches FOR ALL
USING (((organization_id = ANY (get_user_organization_ids())) AND has_role(auth.uid(), 'admin')) OR is_super_admin(auth.uid()));

-- RLS Policies for cohort_students
CREATE POLICY "Users can view cohort students in their organization"
ON public.cohort_students FOR SELECT
USING (((organization_id = ANY (get_user_organization_ids())) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can insert cohort students in their organization"
ON public.cohort_students FOR INSERT
WITH CHECK (((organization_id = ANY (get_user_organization_ids())) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can update cohort students in their organization"
ON public.cohort_students FOR UPDATE
USING (((organization_id = ANY (get_user_organization_ids())) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can delete cohort students in their organization"
ON public.cohort_students FOR DELETE
USING (((organization_id = ANY (get_user_organization_ids())) AND has_role(auth.uid(), 'admin')) OR is_super_admin(auth.uid()));

-- RLS Policies for cohort_emi_payments
CREATE POLICY "Users can view cohort EMI in their organization"
ON public.cohort_emi_payments FOR SELECT
USING (((organization_id = ANY (get_user_organization_ids())) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can insert cohort EMI in their organization"
ON public.cohort_emi_payments FOR INSERT
WITH CHECK (((organization_id = ANY (get_user_organization_ids())) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can update cohort EMI in their organization"
ON public.cohort_emi_payments FOR UPDATE
USING (((organization_id = ANY (get_user_organization_ids())) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can delete cohort EMI in their organization"
ON public.cohort_emi_payments FOR DELETE
USING (((organization_id = ANY (get_user_organization_ids())) AND has_role(auth.uid(), 'admin')) OR is_super_admin(auth.uid()));

-- RLS Policies for cohort_offer_amount_history
CREATE POLICY "Users can view cohort offer history in their organization"
ON public.cohort_offer_amount_history FOR SELECT
USING (((organization_id = ANY (get_user_organization_ids())) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can insert cohort offer history in their organization"
ON public.cohort_offer_amount_history FOR INSERT
WITH CHECK (((organization_id = ANY (get_user_organization_ids())) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))) OR is_super_admin(auth.uid()));

-- Add indexes for performance
CREATE INDEX idx_cohort_batches_org ON public.cohort_batches(organization_id);
CREATE INDEX idx_cohort_batches_type ON public.cohort_batches(cohort_type_id);
CREATE INDEX idx_cohort_students_batch ON public.cohort_students(cohort_batch_id);
CREATE INDEX idx_cohort_students_org ON public.cohort_students(organization_id);
CREATE INDEX idx_cohort_emi_student ON public.cohort_emi_payments(student_id);
CREATE INDEX idx_cohort_emi_org ON public.cohort_emi_payments(organization_id);
