-- Create cohort_types table for dynamic sidebar menu
CREATE TABLE public.cohort_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  route text NOT NULL,
  icon text DEFAULT 'Users',
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(organization_id, slug)
);

-- Enable RLS
ALTER TABLE public.cohort_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view cohort types in their organization"
ON public.cohort_types FOR SELECT
USING (
  (organization_id = ANY(get_user_organization_ids()))
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Admins can manage cohort types in their organization"
ON public.cohort_types FOR ALL
USING (
  ((organization_id = ANY(get_user_organization_ids())) AND has_role(auth.uid(), 'admin'::app_role))
  OR is_super_admin(auth.uid())
);

-- Insert default cohort types for existing organizations
INSERT INTO public.cohort_types (organization_id, name, slug, route, icon, display_order)
SELECT 
  id,
  'Insider Crypto Club',
  'batches',
  '/batches',
  'Users',
  1
FROM public.organizations;

INSERT INTO public.cohort_types (organization_id, name, slug, route, icon, display_order)
SELECT 
  id,
  'Future Mentorship',
  'futures-mentorship',
  '/futures-mentorship',
  'TrendingUp',
  2
FROM public.organizations;

INSERT INTO public.cohort_types (organization_id, name, slug, route, icon, display_order)
SELECT 
  id,
  'High Future',
  'high-future',
  '/high-future',
  'Rocket',
  3
FROM public.organizations;