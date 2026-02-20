
-- Create organization_feature_overrides table for granular per-org control
CREATE TABLE public.organization_feature_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  disabled_permissions TEXT[] DEFAULT '{}',
  disabled_integrations TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Enable RLS
ALTER TABLE public.organization_feature_overrides ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY "Super admins can manage all overrides"
ON public.organization_feature_overrides
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- Org members can read their own overrides
CREATE POLICY "Org members can read own overrides"
ON public.organization_feature_overrides
FOR SELECT
TO authenticated
USING (public.user_belongs_to_org(auth.uid(), organization_id));

-- Auto-update updated_at
CREATE TRIGGER update_org_feature_overrides_updated_at
BEFORE UPDATE ON public.organization_feature_overrides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
