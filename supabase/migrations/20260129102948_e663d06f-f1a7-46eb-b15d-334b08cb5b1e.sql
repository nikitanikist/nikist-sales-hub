-- Organization Integrations System for Multi-Tenant SaaS
-- This enables per-organization configuration of Zoom, Calendly, WhatsApp, etc.

-- Table to store organization-level integration credentials
CREATE TABLE IF NOT EXISTS organization_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL, -- 'zoom', 'calendly', 'whatsapp', 'pabbly'
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_org_integration UNIQUE(organization_id, integration_type)
);

-- Table to map closers to specific integrations (e.g., which Zoom account they use)
CREATE TABLE IF NOT EXISTS closer_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  closer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES organization_integrations(id) ON DELETE CASCADE,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_closer_integration UNIQUE(closer_id, integration_id)
);

-- Enable RLS on both tables
ALTER TABLE organization_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE closer_integrations ENABLE ROW LEVEL SECURITY;

-- RLS policies for organization_integrations
-- Only org admins and super admins can view/manage integrations (sensitive credentials)
CREATE POLICY "Org admins can view integrations" ON organization_integrations
  FOR SELECT USING (
    (organization_id = ANY(get_user_organization_ids()) AND is_org_admin(auth.uid(), organization_id))
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Org admins can insert integrations" ON organization_integrations
  FOR INSERT WITH CHECK (
    (organization_id = ANY(get_user_organization_ids()) AND is_org_admin(auth.uid(), organization_id))
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Org admins can update integrations" ON organization_integrations
  FOR UPDATE USING (
    (organization_id = ANY(get_user_organization_ids()) AND is_org_admin(auth.uid(), organization_id))
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Org admins can delete integrations" ON organization_integrations
  FOR DELETE USING (
    (organization_id = ANY(get_user_organization_ids()) AND is_org_admin(auth.uid(), organization_id))
    OR is_super_admin(auth.uid())
  );

-- RLS policies for closer_integrations
CREATE POLICY "Org admins can view closer integrations" ON closer_integrations
  FOR SELECT USING (
    (organization_id = ANY(get_user_organization_ids()) AND is_org_admin(auth.uid(), organization_id))
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Org admins can manage closer integrations" ON closer_integrations
  FOR ALL USING (
    (organization_id = ANY(get_user_organization_ids()) AND is_org_admin(auth.uid(), organization_id))
    OR is_super_admin(auth.uid())
  );

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_org_integrations_org_type ON organization_integrations(organization_id, integration_type);
CREATE INDEX IF NOT EXISTS idx_closer_integrations_closer ON closer_integrations(closer_id);
CREATE INDEX IF NOT EXISTS idx_closer_integrations_org ON closer_integrations(organization_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_org_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_org_integrations_updated_at
  BEFORE UPDATE ON organization_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_org_integrations_updated_at();

-- Seed the default Nikist organization with existing integrations
-- This preserves backward compatibility with the current hardcoded setup
INSERT INTO organization_integrations (organization_id, integration_type, config, is_active)
VALUES 
  -- Zoom for Adesh
  ('00000000-0000-0000-0000-000000000001', 'zoom', jsonb_build_object(
    'host_email', 'aadeshnikist@gmail.com',
    'uses_env_secrets', true,
    'account_id_secret', 'ZOOM_ADESH_ACCOUNT_ID',
    'client_id_secret', 'ZOOM_ADESH_CLIENT_ID',
    'client_secret_secret', 'ZOOM_ADESH_CLIENT_SECRET'
  ), true),
  -- Calendly for Dipanshu
  ('00000000-0000-0000-0000-000000000001', 'calendly_dipanshu', jsonb_build_object(
    'host_email', 'nikistofficial@gmail.com',
    'uses_env_secrets', true,
    'token_secret', 'CALENDLY_DIPANSHU_TOKEN',
    'calendly_url', 'https://calendly.com/nikist/1-1-call-with-dipanshu-malasi-clone'
  ), true),
  -- Calendly for Akansha
  ('00000000-0000-0000-0000-000000000001', 'calendly_akansha', jsonb_build_object(
    'host_email', 'akanshanikist@gmail.com',
    'uses_env_secrets', true,
    'token_secret', 'CALENDLY_AKANSHA_TOKEN'
  ), true),
  -- WhatsApp/AiSensy
  ('00000000-0000-0000-0000-000000000001', 'whatsapp', jsonb_build_object(
    'uses_env_secrets', true,
    'api_key_secret', 'AISENSY_API_KEY',
    'source_secret', 'AISENSY_SOURCE',
    'templates', jsonb_build_object(
      'call_booked_dipanshu', '1_to_1_call_booking_crypto_dipanshu',
      'call_booked_akansha', '1_to_1_call_booking_crypto_nikist_video',
      'two_days', 'cryptoreminder2days',
      'one_day', 'cryptoreminder1days',
      'three_hours', 'cryptoreminder3hrs',
      'one_hour', 'cryptoreminder1hr',
      'thirty_minutes', 'cryptoreminder30min',
      'ten_minutes', 'cryptoreminder10min',
      'we_are_live', '1_1_live'
    ),
    'video_urls', jsonb_build_object(
      'dipanshu', 'https://d3jt6ku4g6z5l8.cloudfront.net/VIDEO/66f4f03f444c5c0b8013168b/227807_Updated 11.mp4',
      'akansha', 'https://d3jt6ku4g6z5l8.cloudfront.net/VIDEO/66f4f03f444c5c0b8013168b/5384969_1706706new video 1 14.mp4'
    )
  ), true)
ON CONFLICT (organization_id, integration_type) DO NOTHING;