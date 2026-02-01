-- Phase 1: Default tag feature
ALTER TABLE workshop_tags 
ADD COLUMN is_default BOOLEAN DEFAULT FALSE;

-- Ensure only one tag can be default per organization
CREATE UNIQUE INDEX idx_workshop_tags_default_unique 
ON workshop_tags (organization_id) 
WHERE is_default = TRUE;

-- Phase 2: Community templates table
CREATE TABLE community_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES workshop_tags(id) ON DELETE CASCADE,
  profile_picture_url TEXT,
  description_template TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, tag_id)
);

-- RLS Policies
ALTER TABLE community_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view templates in their org" ON community_templates
  FOR SELECT USING (
    organization_id = ANY(get_user_organization_ids()) 
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Admins can manage templates in their org" ON community_templates
  FOR ALL USING (
    (organization_id = ANY(get_user_organization_ids()) 
     AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
    OR is_super_admin(auth.uid())
  );

-- Storage bucket for community template images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('community-templates', 'community-templates', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload to community-templates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'community-templates');

CREATE POLICY "Anyone can view community-templates"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'community-templates');