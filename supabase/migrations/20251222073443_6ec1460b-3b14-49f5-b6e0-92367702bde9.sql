-- Create a server-side search function for leads that searches ALL records
CREATE OR REPLACE FUNCTION public.search_leads(search_query TEXT)
RETURNS TABLE (
  id UUID,
  contact_name TEXT,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  country TEXT,
  status TEXT,
  notes TEXT,
  workshop_name TEXT,
  source TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  assigned_to UUID,
  assigned_to_name TEXT,
  assignment_id UUID,
  workshop_id UUID,
  workshop_title TEXT,
  product_id UUID,
  product_name TEXT,
  product_price NUMERIC,
  funnel_id UUID,
  funnel_name TEXT,
  is_connected BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  search_pattern TEXT;
BEGIN
  -- Create search pattern for ILIKE
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
    la.is_connected
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
$$;