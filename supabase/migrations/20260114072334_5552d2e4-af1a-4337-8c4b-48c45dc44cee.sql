
-- Create futures_mentorship_batches table
CREATE TABLE public.futures_mentorship_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  event_dates TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed')),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create futures_mentorship_students table
CREATE TABLE public.futures_mentorship_students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES public.futures_mentorship_batches(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id),
  conversion_date DATE NOT NULL DEFAULT CURRENT_DATE,
  offer_amount NUMERIC DEFAULT 0,
  cash_received NUMERIC DEFAULT 0,
  due_amount NUMERIC DEFAULT 0,
  classes_access INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'refunded', 'discontinued')),
  notes TEXT,
  refund_reason TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create futures_emi_payments table
CREATE TABLE public.futures_emi_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.futures_mentorship_students(id) ON DELETE CASCADE,
  emi_number INTEGER NOT NULL,
  amount NUMERIC NOT NULL,
  payment_date DATE NOT NULL,
  previous_cash_received NUMERIC,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create futures_offer_amount_history table
CREATE TABLE public.futures_offer_amount_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.futures_mentorship_students(id) ON DELETE CASCADE,
  previous_amount NUMERIC NOT NULL,
  new_amount NUMERIC NOT NULL,
  reason TEXT,
  changed_by UUID REFERENCES public.profiles(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.futures_mentorship_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.futures_mentorship_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.futures_emi_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.futures_offer_amount_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for futures_mentorship_batches
CREATE POLICY "Admins and managers can view futures batches"
ON public.futures_mentorship_batches FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins can insert futures batches"
ON public.futures_mentorship_batches FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update futures batches"
ON public.futures_mentorship_batches FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete futures batches"
ON public.futures_mentorship_batches FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- RLS policies for futures_mentorship_students
CREATE POLICY "Admins and managers can view futures students"
ON public.futures_mentorship_students FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins and managers can insert futures students"
ON public.futures_mentorship_students FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins and managers can update futures students"
ON public.futures_mentorship_students FOR UPDATE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins can delete futures students"
ON public.futures_mentorship_students FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- RLS policies for futures_emi_payments
CREATE POLICY "Admins and managers can view futures EMI"
ON public.futures_emi_payments FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins and managers can insert futures EMI"
ON public.futures_emi_payments FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins and managers can update futures EMI"
ON public.futures_emi_payments FOR UPDATE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins can delete futures EMI"
ON public.futures_emi_payments FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- RLS policies for futures_offer_amount_history
CREATE POLICY "Admins and managers can view futures offer history"
ON public.futures_offer_amount_history FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins and managers can insert futures offer history"
ON public.futures_offer_amount_history FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Create trigger for updated_at on futures_mentorship_batches
CREATE TRIGGER update_futures_mentorship_batches_updated_at
BEFORE UPDATE ON public.futures_mentorship_batches
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert the first batch: Future Mentorship Batch 9
INSERT INTO public.futures_mentorship_batches (name, event_dates, status, is_active)
VALUES ('Future Mentorship Batch 9', 'TBD', 'active', true);
