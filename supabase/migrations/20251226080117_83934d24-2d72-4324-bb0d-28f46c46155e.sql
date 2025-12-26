CREATE OR REPLACE FUNCTION public.get_workshop_sales_leads(p_workshop_title text)
RETURNS TABLE(
  id uuid, 
  lead_id uuid,
  contact_name text, 
  email text, 
  phone text,
  scheduled_date date,
  scheduled_time time without time zone,
  status text,
  closer_name text,
  has_call_appointment boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_workshop_id uuid;
BEGIN
  SELECT w.id INTO v_workshop_id FROM workshops w WHERE w.title = p_workshop_title LIMIT 1;
  
  RETURN QUERY
  SELECT DISTINCT ON (l.id)
    l.id as id,
    l.id as lead_id,
    l.contact_name,
    l.email,
    l.phone,
    ca.scheduled_date,
    ca.scheduled_time,
    ca.status::TEXT,
    p.full_name as closer_name,
    (ca.id IS NOT NULL) as has_call_appointment
  FROM leads l
  INNER JOIN lead_assignments la1 ON la1.lead_id = l.id AND la1.workshop_id = v_workshop_id
  INNER JOIN lead_assignments la2 ON la2.lead_id = l.id AND la2.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053'
  LEFT JOIN call_appointments ca ON ca.lead_id = l.id
  LEFT JOIN profiles p ON p.id = ca.closer_id
  ORDER BY l.id, ca.scheduled_date DESC NULLS LAST;
END;
$function$;