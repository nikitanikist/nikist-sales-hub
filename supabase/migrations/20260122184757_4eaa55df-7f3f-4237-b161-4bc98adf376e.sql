-- Create daily_money_flow table for tracking daily revenue and cash collection
CREATE TABLE public.daily_money_flow (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  total_revenue NUMERIC NOT NULL DEFAULT 0,
  cash_collected NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.daily_money_flow ENABLE ROW LEVEL SECURITY;

-- Create policies for admins and managers
CREATE POLICY "Admins and managers can view daily money flow"
ON public.daily_money_flow
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins and managers can insert daily money flow"
ON public.daily_money_flow
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins and managers can update daily money flow"
ON public.daily_money_flow
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins can delete daily money flow"
ON public.daily_money_flow
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_daily_money_flow_updated_at
BEFORE UPDATE ON public.daily_money_flow
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();