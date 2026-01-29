-- Add integration_name column for display purposes
ALTER TABLE organization_integrations 
ADD COLUMN IF NOT EXISTS integration_name TEXT;

-- Update existing records with meaningful names based on integration_type
UPDATE organization_integrations 
SET integration_name = 'Adesh Zoom' 
WHERE integration_type = 'zoom' AND integration_name IS NULL;

UPDATE organization_integrations 
SET integration_name = 'Dipanshu Calendly' 
WHERE integration_type = 'calendly_dipanshu' AND integration_name IS NULL;

UPDATE organization_integrations 
SET integration_name = 'Akansha Calendly' 
WHERE integration_type = 'calendly_akansha' AND integration_name IS NULL;

UPDATE organization_integrations 
SET integration_name = 'Main WhatsApp' 
WHERE integration_type = 'whatsapp' AND integration_name IS NULL;

-- For any other integrations, set a default name based on type
UPDATE organization_integrations 
SET integration_name = CONCAT(UPPER(SUBSTRING(integration_type FROM 1 FOR 1)), SUBSTRING(integration_type FROM 2), ' Integration')
WHERE integration_name IS NULL;