-- =============================================
-- PHASE 1: MODULE SYSTEM TABLES
-- =============================================

-- modules table (system-wide definitions)
CREATE TABLE public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  is_premium BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

-- Everyone can view modules (read-only reference table)
CREATE POLICY "Anyone can view modules"
ON public.modules
FOR SELECT
USING (true);

-- Only super admins can manage modules
CREATE POLICY "Super admins can manage modules"
ON public.modules
FOR ALL
USING (is_super_admin(auth.uid()));

-- organization_modules (per-org enablement)
CREATE TABLE public.organization_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT false,
  enabled_at TIMESTAMPTZ,
  enabled_by UUID REFERENCES public.profiles(id),
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_org_module UNIQUE(organization_id, module_id)
);

-- Enable RLS
ALTER TABLE public.organization_modules ENABLE ROW LEVEL SECURITY;

-- Users can view their org's modules
CREATE POLICY "Users can view their org modules"
ON public.organization_modules
FOR SELECT
USING (
  (organization_id = ANY(get_user_organization_ids()))
  OR is_super_admin(auth.uid())
);

-- Only super admins can manage org modules
CREATE POLICY "Super admins can manage org modules"
ON public.organization_modules
FOR ALL
USING (is_super_admin(auth.uid()));

-- =============================================
-- PHASE 2: WEBHOOKS TABLE (PABBLY)
-- =============================================

CREATE TABLE public.organization_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  url TEXT,
  secret TEXT DEFAULT encode(gen_random_bytes(32), 'hex'),
  trigger_event TEXT,
  payload_template JSONB DEFAULT '{}',
  field_mappings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.organization_webhooks ENABLE ROW LEVEL SECURITY;

-- Org admins can view their org's webhooks
CREATE POLICY "Org admins can view webhooks"
ON public.organization_webhooks
FOR SELECT
USING (
  ((organization_id = ANY(get_user_organization_ids())) AND is_org_admin(auth.uid(), organization_id))
  OR is_super_admin(auth.uid())
);

-- Org admins can manage their org's webhooks
CREATE POLICY "Org admins can manage webhooks"
ON public.organization_webhooks
FOR ALL
USING (
  ((organization_id = ANY(get_user_organization_ids())) AND is_org_admin(auth.uid(), organization_id))
  OR is_super_admin(auth.uid())
);

-- =============================================
-- PHASE 3: SEED MODULE DATA
-- =============================================

INSERT INTO public.modules (slug, name, description, icon, display_order) VALUES
  ('one-to-one-funnel', 'One-to-One Sales Funnel', 'Sales closers, call scheduling, Zoom/Calendly integration, WhatsApp reminders', 'Phone', 1),
  ('cohort-management', 'Cohort Management', 'Batches, students, EMI tracking, cohort insights', 'GraduationCap', 2),
  ('workshops', 'Workshops', 'Workshop management, registrations, and attendance tracking', 'Presentation', 3),
  ('daily-money-flow', 'Daily Money Flow', 'Revenue tracking, cash collection, and financial insights', 'DollarSign', 4);

-- Auto-enable ALL modules for Nikist organization
INSERT INTO public.organization_modules (organization_id, module_id, is_enabled, enabled_at)
SELECT '00000000-0000-0000-0000-000000000001', m.id, true, NOW()
FROM public.modules m;

-- =============================================
-- PHASE 4: SEED CLOSER INTEGRATIONS (CRITICAL)
-- =============================================

-- Adesh uses Zoom
INSERT INTO public.closer_integrations (organization_id, closer_id, integration_id, is_default)
SELECT
  '00000000-0000-0000-0000-000000000001',
  p.id,
  oi.id,
  true
FROM public.profiles p
CROSS JOIN public.organization_integrations oi
WHERE p.email = 'aadeshnikist@gmail.com'
  AND oi.organization_id = '00000000-0000-0000-0000-000000000001'
  AND oi.integration_type = 'zoom'
ON CONFLICT DO NOTHING;

-- Dipanshu uses Calendly
INSERT INTO public.closer_integrations (organization_id, closer_id, integration_id, is_default)
SELECT
  '00000000-0000-0000-0000-000000000001',
  p.id,
  oi.id,
  true
FROM public.profiles p
CROSS JOIN public.organization_integrations oi
WHERE p.email = 'nikistofficial@gmail.com'
  AND oi.organization_id = '00000000-0000-0000-0000-000000000001'
  AND oi.integration_type = 'calendly_dipanshu'
ON CONFLICT DO NOTHING;

-- Akansha uses Calendly
INSERT INTO public.closer_integrations (organization_id, closer_id, integration_id, is_default)
SELECT
  '00000000-0000-0000-0000-000000000001',
  p.id,
  oi.id,
  true
FROM public.profiles p
CROSS JOIN public.organization_integrations oi
WHERE p.email = 'akanshanikist@gmail.com'
  AND oi.organization_id = '00000000-0000-0000-0000-000000000001'
  AND oi.integration_type = 'calendly_akansha'
ON CONFLICT DO NOTHING;