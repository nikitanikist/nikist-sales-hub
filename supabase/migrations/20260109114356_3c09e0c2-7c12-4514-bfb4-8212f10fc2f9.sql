DROP FUNCTION IF EXISTS public.search_leads(text);

CREATE OR REPLACE FUNCTION public.search_leads(search_query text)
 RETURNS TABLE(
   id uuid, 
   contact_name text, 
   company_name text, 
   email text, 
   phone text, 
   country text, 
   status text, 
   notes text, 
   workshop_name text, 
   source text, 
   created_at timestamp with time zone, 
   updated_at timestamp with time zone, 
   assigned_to uuid, 
   assigned_to_name text, 
   assignment_id uuid, 
   workshop_id uuid, 
   workshop_title text, 
   product_id uuid, 
   product_name text, 
   product_price numeric, 
   funnel_id uuid, 
   funnel_name text, 
   is_connected boolean,
   is_refunded boolean,
   refund_reason text,
   refunded_at timestamp with time zone
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  search_pattern TEXT;
BEGIN
  search_pattern := '%' || LOWER(search_query) || '%';
  
  RETURN QUERY
  SELECT DISTINCT ON (l.id, la.id)
    l.id,
    l.contact_name,
    l.company_name,
    l.email,
    l.phone,
    l.country,
    l.status::TEXT,
    l.notes,
    l.workshop_name,
    l.source,
    l.created_at,
    l.updated_at,
    l.assigned_to,
    p.full_name as assigned_to_name,
    la.id as assignment_id,
    la.workshop_id,
    w.title as workshop_title,
    la.product_id,
    pr.product_name,
    pr.price as product_price,
    la.funnel_id,
    f.funnel_name,
    la.is_connected,
    la.is_refunded,
    la.refund_reason,
    la.refunded_at
  FROM leads l
  LEFT JOIN profiles p ON p.id = l.assigned_to
  LEFT JOIN lead_assignments la ON la.lead_id = l.id
  LEFT JOIN workshops w ON w.id = la.workshop_id
  LEFT JOIN products pr ON pr.id = la.product_id
  LEFT JOIN funnels f ON f.id = la.funnel_id
  WHERE 
    LOWER(l.contact_name) LIKE search_pattern
    OR LOWER(l.email) LIKE search_pattern
    OR LOWER(l.phone) LIKE search_pattern
  ORDER BY l.id, la.id, l.created_at DESC;
END;
$function$;