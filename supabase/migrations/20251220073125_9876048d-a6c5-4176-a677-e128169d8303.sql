-- Create function to get workshop name for a lead with smart matching
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
BEGIN
  -- First, get the lead's current workshop_name, email, and phone
  SELECT email, phone, workshop_name 
  INTO lead_email, lead_phone, lead_workshop
  FROM leads 
  WHERE id = p_lead_id;
  
  -- If lead already has workshop_name, return it
  IF lead_workshop IS NOT NULL AND lead_workshop != '' THEN
    RETURN lead_workshop;
  END IF;
  
  -- Try to match by email first
  IF lead_email IS NOT NULL THEN
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
  
  -- Try to match by phone number
  IF lead_phone IS NOT NULL THEN
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