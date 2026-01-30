-- Add is_admin column to whatsapp_groups table
ALTER TABLE public.whatsapp_groups 
ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Create junction table for workshop-to-multiple-groups relationship
CREATE TABLE public.workshop_whatsapp_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.whatsapp_groups(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(workshop_id, group_id)
);

-- Enable RLS
ALTER TABLE public.workshop_whatsapp_groups ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can view workshop groups in their org
CREATE POLICY "Users can view workshop groups in their org"
  ON public.workshop_whatsapp_groups FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.workshops w 
    WHERE w.id = workshop_id 
    AND (w.organization_id = ANY(get_user_organization_ids()) OR is_super_admin(auth.uid()))
  ));

-- RLS policy: Admins can manage workshop groups
CREATE POLICY "Admins can manage workshop groups"
  ON public.workshop_whatsapp_groups FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.workshops w 
    WHERE w.id = workshop_id 
    AND ((w.organization_id = ANY(get_user_organization_ids()) 
         AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
        OR is_super_admin(auth.uid()))
  ));