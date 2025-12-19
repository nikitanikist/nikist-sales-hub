-- Create a function to get workshop metrics (registrations and sales)
CREATE OR REPLACE FUNCTION public.get_workshop_metrics()
RETURNS TABLE (
  workshop_id uuid,
  registration_count bigint,
  sales_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    w.id as workshop_id,
    -- Registration count: leads where workshop_name = workshop title
    (SELECT COUNT(*) FROM leads WHERE workshop_name = w.title) as registration_count,
    -- Sales count: leads with BOTH workshop_id assignment AND ₹497 product assignment (in separate rows)
    (
      SELECT COUNT(DISTINCT la1.lead_id)
      FROM lead_assignments la1
      INNER JOIN lead_assignments la2 ON la2.lead_id = la1.lead_id
      WHERE la1.workshop_id = w.id
      AND la2.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053'
    ) as sales_count
  FROM workshops w;
$$;