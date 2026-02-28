
-- Create registration_confirmation_rules table
CREATE TABLE public.registration_confirmation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  trigger_platform TEXT NOT NULL DEFAULT 'tagmango',
  trigger_id TEXT NOT NULL,
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  aisensy_integration_id UUID REFERENCES public.organization_integrations(id),
  template_name TEXT NOT NULL,
  variable_mapping JSONB NOT NULL DEFAULT '[]'::jsonb,
  google_sheet_webhook_url TEXT,
  sheet_send_duplicates BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, trigger_id)
);

-- Enable RLS
ALTER TABLE public.registration_confirmation_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies: org members can read, org admins can manage
CREATE POLICY "Org members can view rules"
  ON public.registration_confirmation_rules
  FOR SELECT
  USING (organization_id = ANY(public.get_user_organization_ids()));

CREATE POLICY "Org admins can insert rules"
  ON public.registration_confirmation_rules
  FOR INSERT
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Org admins can update rules"
  ON public.registration_confirmation_rules
  FOR UPDATE
  USING (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Org admins can delete rules"
  ON public.registration_confirmation_rules
  FOR DELETE
  USING (public.is_org_admin(auth.uid(), organization_id));

-- Super admins bypass
CREATE POLICY "Super admins full access on rules"
  ON public.registration_confirmation_rules
  FOR ALL
  USING (public.is_super_admin(auth.uid()));

-- Auto-update updated_at
CREATE TRIGGER update_registration_rules_updated_at
  BEFORE UPDATE ON public.registration_confirmation_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed existing hardcoded Nikist rules
INSERT INTO public.registration_confirmation_rules (
  organization_id, trigger_platform, trigger_id, label, is_active,
  aisensy_integration_id, template_name, variable_mapping,
  google_sheet_webhook_url, sheet_send_duplicates
) VALUES
(
  '00000000-0000-0000-0000-000000000001',
  'tagmango',
  '689b7b7e37ddd15a781ec63b',
  'Crypto Masterclass Confirmation',
  true,
  '459398a2-dae8-4a20-a4cb-de87cc4add1b',
  'class_registration_confirmation_copy',
  '[
    {"position": 1, "source": "registrant_name"},
    {"position": 2, "source": "workshop_title"},
    {"position": 3, "source": "workshop_date"},
    {"position": 4, "source": "static", "value": "7 PM"},
    {"position": 5, "source": "static", "value": "https://nikist.in/registrartionsuccessful"}
  ]'::jsonb,
  null,
  false
),
(
  '00000000-0000-0000-0000-000000000001',
  'tagmango',
  '6899e47bfa8e61e188499df3',
  'YouTube Registration Confirmation',
  true,
  '459398a2-dae8-4a20-a4cb-de87cc4add1b',
  'youtube_registration_confirmation',
  '[
    {"position": 1, "source": "registrant_name"},
    {"position": 2, "source": "workshop_title"},
    {"position": 3, "source": "workshop_date"},
    {"position": 4, "source": "static", "value": "7 PM"},
    {"position": 5, "source": "static", "value": "https://nikistschool.in/yt"}
  ]'::jsonb,
  null,
  true
);
