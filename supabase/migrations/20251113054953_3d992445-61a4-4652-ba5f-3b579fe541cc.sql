-- Create lead_assignments junction table
CREATE TABLE public.lead_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  workshop_id uuid REFERENCES public.workshops(id) ON DELETE SET NULL,
  funnel_id uuid REFERENCES public.funnels(id) ON DELETE SET NULL,
  is_connected boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id),
  
  CONSTRAINT at_least_one_assignment CHECK (
    workshop_id IS NOT NULL OR funnel_id IS NOT NULL
  ),
  
  CONSTRAINT unique_assignment UNIQUE(lead_id, workshop_id, funnel_id)
);

-- Enable RLS
ALTER TABLE public.lead_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view all assignments"
  ON public.lead_assignments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Sales reps and admins can create assignments"
  ON public.lead_assignments FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales_rep'::app_role));

CREATE POLICY "Sales reps and admins can update assignments"
  ON public.lead_assignments FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales_rep'::app_role));

CREATE POLICY "Only admins can delete assignments"
  ON public.lead_assignments FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_lead_assignments_updated_at
  BEFORE UPDATE ON public.lead_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add is_free column to workshops table for future use
ALTER TABLE public.workshops ADD COLUMN IF NOT EXISTS is_free boolean DEFAULT false;

-- Add is_free column to funnels table for future use
ALTER TABLE public.funnels ADD COLUMN IF NOT EXISTS is_free boolean DEFAULT false;

-- Migrate existing workshop_name data to lead_assignments
INSERT INTO public.lead_assignments (lead_id, workshop_id, created_by, created_at)
SELECT 
  l.id,
  w.id,
  l.created_by,
  l.created_at
FROM public.leads l
INNER JOIN public.workshops w ON w.title = l.workshop_name
WHERE l.workshop_name IS NOT NULL
ON CONFLICT (lead_id, workshop_id, funnel_id) DO NOTHING;