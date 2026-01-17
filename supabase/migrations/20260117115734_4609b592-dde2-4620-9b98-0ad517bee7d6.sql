-- Create high_future_batches table
CREATE TABLE public.high_future_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    event_dates text,
    status text NOT NULL DEFAULT 'planned'::text,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on high_future_batches
ALTER TABLE public.high_future_batches ENABLE ROW LEVEL SECURITY;

-- RLS policies for high_future_batches
CREATE POLICY "Admins and managers can view high future batches"
ON public.high_future_batches FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins can insert high future batches"
ON public.high_future_batches FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update high future batches"
ON public.high_future_batches FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete high future batches"
ON public.high_future_batches FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create high_future_students table
CREATE TABLE public.high_future_students (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id uuid NOT NULL,
    lead_id uuid,
    conversion_date date NOT NULL DEFAULT CURRENT_DATE,
    offer_amount numeric DEFAULT 0,
    cash_received numeric DEFAULT 0,
    due_amount numeric DEFAULT 0,
    classes_access integer DEFAULT 0,
    no_cost_emi numeric DEFAULT 0,
    gst_fees numeric DEFAULT 0,
    platform_fees numeric DEFAULT 0,
    payment_platform text,
    payment_remarks text,
    notes text,
    status text NOT NULL DEFAULT 'active'::text,
    refund_reason text,
    created_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on high_future_students
ALTER TABLE public.high_future_students ENABLE ROW LEVEL SECURITY;

-- RLS policies for high_future_students
CREATE POLICY "Admins and managers can view high future students"
ON public.high_future_students FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins and managers can insert high future students"
ON public.high_future_students FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins and managers can update high future students"
ON public.high_future_students FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins can delete high future students"
ON public.high_future_students FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create high_future_emi_payments table
CREATE TABLE public.high_future_emi_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL,
    emi_number integer NOT NULL,
    amount numeric NOT NULL,
    payment_date date NOT NULL,
    previous_cash_received numeric,
    no_cost_emi numeric DEFAULT 0,
    gst_fees numeric DEFAULT 0,
    platform_fees numeric DEFAULT 0,
    payment_platform text DEFAULT 'UPI (IDFC)'::text,
    remarks text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on high_future_emi_payments
ALTER TABLE public.high_future_emi_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies for high_future_emi_payments
CREATE POLICY "Admins and managers can view high future EMI"
ON public.high_future_emi_payments FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins and managers can insert high future EMI"
ON public.high_future_emi_payments FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins and managers can update high future EMI"
ON public.high_future_emi_payments FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins can delete high future EMI"
ON public.high_future_emi_payments FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create high_future_offer_amount_history table
CREATE TABLE public.high_future_offer_amount_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL,
    previous_amount numeric NOT NULL,
    new_amount numeric NOT NULL,
    reason text,
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on high_future_offer_amount_history
ALTER TABLE public.high_future_offer_amount_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for high_future_offer_amount_history
CREATE POLICY "Admins and managers can view high future offer history"
ON public.high_future_offer_amount_history FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins and managers can insert high future offer history"
ON public.high_future_offer_amount_history FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));