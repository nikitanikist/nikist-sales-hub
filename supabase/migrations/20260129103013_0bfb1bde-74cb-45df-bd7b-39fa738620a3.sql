-- Fix the search_path security issue for the trigger function
CREATE OR REPLACE FUNCTION update_org_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;