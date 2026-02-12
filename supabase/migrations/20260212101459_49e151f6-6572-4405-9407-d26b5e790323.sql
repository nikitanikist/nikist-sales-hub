
-- Create closer_notification_configs table for per-closer AISensy notification settings
CREATE TABLE public.closer_notification_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  closer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  aisensy_integration_id UUID REFERENCES public.organization_integrations(id) ON DELETE SET NULL,
  templates JSONB NOT NULL DEFAULT '{}'::jsonb,
  video_url TEXT,
  support_number TEXT,
  include_zoom_link_types TEXT[] NOT NULL DEFAULT ARRAY['ten_minutes', 'we_are_live']::text[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, closer_id)
);

-- Enable RLS
ALTER TABLE public.closer_notification_configs ENABLE ROW LEVEL SECURITY;

-- Org members can view
CREATE POLICY "Org members can view closer notification configs"
ON public.closer_notification_configs
FOR SELECT
USING (
  public.is_super_admin(auth.uid())
  OR organization_id = ANY(public.get_user_organization_ids())
);

-- Org admins can insert
CREATE POLICY "Org admins can insert closer notification configs"
ON public.closer_notification_configs
FOR INSERT
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.is_org_admin(auth.uid(), organization_id)
);

-- Org admins can update
CREATE POLICY "Org admins can update closer notification configs"
ON public.closer_notification_configs
FOR UPDATE
USING (
  public.is_super_admin(auth.uid())
  OR public.is_org_admin(auth.uid(), organization_id)
);

-- Org admins can delete
CREATE POLICY "Org admins can delete closer notification configs"
ON public.closer_notification_configs
FOR DELETE
USING (
  public.is_super_admin(auth.uid())
  OR public.is_org_admin(auth.uid(), organization_id)
);

-- Add updated_at trigger
CREATE TRIGGER update_closer_notification_configs_updated_at
BEFORE UPDATE ON public.closer_notification_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
