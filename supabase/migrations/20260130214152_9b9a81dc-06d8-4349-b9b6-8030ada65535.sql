-- Create table for storing workshop-specific variable values
CREATE TABLE IF NOT EXISTS workshop_sequence_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  variable_key TEXT NOT NULL,
  variable_value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workshop_id, variable_key)
);

-- Enable RLS
ALTER TABLE workshop_sequence_variables ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view variables in their org"
ON workshop_sequence_variables FOR SELECT
USING (
  organization_id = ANY(get_user_organization_ids()) 
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Admins can manage variables in their org"
ON workshop_sequence_variables FOR ALL
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)))
  OR is_super_admin(auth.uid())
);