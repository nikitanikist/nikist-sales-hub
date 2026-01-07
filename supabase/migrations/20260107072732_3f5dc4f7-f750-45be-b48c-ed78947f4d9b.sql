-- Create offer amount history table for audit trail
CREATE TABLE public.offer_amount_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES call_appointments(id) ON DELETE CASCADE,
  previous_amount NUMERIC NOT NULL,
  new_amount NUMERIC NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  changed_by UUID REFERENCES profiles(id),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.offer_amount_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view offer amount history"
  ON public.offer_amount_history
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Sales reps, managers and admins can insert offer history"
  ON public.offer_amount_history
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales_rep'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Index for faster lookups
CREATE INDEX idx_offer_amount_history_appointment ON public.offer_amount_history(appointment_id);