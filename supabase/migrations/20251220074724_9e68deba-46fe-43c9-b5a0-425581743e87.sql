-- Update function to prioritize actual workshop assignments from lead_assignments
CREATE OR REPLACE FUNCTION public.get_workshop_name_for_lead(p_lead_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  lead_email text;
  lead_phone text;
  lead_workshop text;
  matched_workshop text;
  assigned_workshop text;
BEGIN
  -- PRIORITY 1: Check lead_assignments for actual workshop assignment
  SELECT w.title INTO assigned_workshop
  FROM lead_assignments la
  INNER JOIN workshops w ON la.workshop_id = w.id
  WHERE la.lead_id = p_lead_id
    AND la.workshop_id IS NOT NULL
  ORDER BY la.created_at DESC
  LIMIT 1;
  
  IF assigned_workshop IS NOT NULL THEN
    RETURN assigned_workshop;
  END IF;
  
  -- Get lead's email, phone, and workshop_name for fallback matching
  SELECT email, phone, workshop_name 
  INTO lead_email, lead_phone, lead_workshop
  FROM leads 
  WHERE id = p_lead_id;
  
  -- PRIORITY 2: Use existing workshop_name if available
  IF lead_workshop IS NOT NULL AND lead_workshop != '' THEN
    RETURN lead_workshop;
  END IF;
  
  -- PRIORITY 3: Try to match by email (check lead_assignments first, then leads.workshop_name)
  IF lead_email IS NOT NULL THEN
    -- Check other leads with same email for workshop assignments
    SELECT w.title INTO matched_workshop
    FROM lead_assignments la
    INNER JOIN leads l ON la.lead_id = l.id
    INNER JOIN workshops w ON la.workshop_id = w.id
    WHERE l.email = lead_email
      AND la.workshop_id IS NOT NULL
      AND l.id != p_lead_id
    ORDER BY la.created_at DESC
    LIMIT 1;
    
    IF matched_workshop IS NOT NULL THEN
      RETURN matched_workshop;
    END IF;
    
    -- Fallback to workshop_name field
    SELECT workshop_name INTO matched_workshop
    FROM leads 
    WHERE email = lead_email 
      AND workshop_name IS NOT NULL 
      AND workshop_name != ''
      AND id != p_lead_id
    LIMIT 1;
    
    IF matched_workshop IS NOT NULL THEN
      RETURN matched_workshop;
    END IF;
  END IF;
  
  -- PRIORITY 4: Try to match by phone (check lead_assignments first, then leads.workshop_name)
  IF lead_phone IS NOT NULL THEN
    -- Check other leads with same phone for workshop assignments
    SELECT w.title INTO matched_workshop
    FROM lead_assignments la
    INNER JOIN leads l ON la.lead_id = l.id
    INNER JOIN workshops w ON la.workshop_id = w.id
    WHERE l.phone = lead_phone
      AND la.workshop_id IS NOT NULL
      AND l.id != p_lead_id
    ORDER BY la.created_at DESC
    LIMIT 1;
    
    IF matched_workshop IS NOT NULL THEN
      RETURN matched_workshop;
    END IF;
    
    -- Fallback to workshop_name field
    SELECT workshop_name INTO matched_workshop
    FROM leads 
    WHERE phone = lead_phone 
      AND workshop_name IS NOT NULL 
      AND workshop_name != ''
      AND id != p_lead_id
    LIMIT 1;
    
    IF matched_workshop IS NOT NULL THEN
      RETURN matched_workshop;
    END IF;
  END IF;
  
  -- No match found
  RETURN NULL;
END;
$$;