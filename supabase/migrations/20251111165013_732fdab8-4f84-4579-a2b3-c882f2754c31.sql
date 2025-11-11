-- Create funnels table
CREATE TABLE public.funnels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funnel_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  total_leads INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Enable Row Level Security
ALTER TABLE public.funnels ENABLE ROW LEVEL SECURITY;

-- Create policies for funnels
CREATE POLICY "Users can view all funnels"
ON public.funnels
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Sales reps and admins can create funnels"
ON public.funnels
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'sales_rep'::app_role)
);

CREATE POLICY "Sales reps and admins can update funnels"
ON public.funnels
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'sales_rep'::app_role)
);

CREATE POLICY "Only admins can delete funnels"
ON public.funnels
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_funnels_updated_at
BEFORE UPDATE ON public.funnels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();