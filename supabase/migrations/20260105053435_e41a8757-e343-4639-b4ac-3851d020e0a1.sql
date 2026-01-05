-- Create EMI payments table for tracking individual EMI payments
CREATE TABLE public.emi_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.call_appointments(id) ON DELETE CASCADE,
  emi_number INTEGER NOT NULL,
  amount NUMERIC NOT NULL,
  payment_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Index for fast lookups by appointment
CREATE INDEX idx_emi_payments_appointment ON public.emi_payments(appointment_id);

-- Enable Row Level Security
ALTER TABLE public.emi_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view EMI payments" ON public.emi_payments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Sales reps and admins can insert EMI payments" ON public.emi_payments
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales_rep'::app_role));

CREATE POLICY "Sales reps and admins can update EMI payments" ON public.emi_payments
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales_rep'::app_role));

CREATE POLICY "Admins can delete EMI payments" ON public.emi_payments
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));