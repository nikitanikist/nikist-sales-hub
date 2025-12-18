-- Create function to get user counts per product (aggregated in database)
CREATE OR REPLACE FUNCTION public.get_product_user_counts()
RETURNS TABLE(product_id uuid, user_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT la.product_id, COUNT(DISTINCT la.lead_id) as user_count
  FROM lead_assignments la
  WHERE la.product_id IS NOT NULL
  GROUP BY la.product_id;
$$;