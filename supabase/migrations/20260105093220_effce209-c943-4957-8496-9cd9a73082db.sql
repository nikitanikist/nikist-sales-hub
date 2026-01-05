CREATE OR REPLACE FUNCTION public.get_closer_call_metrics(target_date date)
RETURNS TABLE (
  id uuid,
  full_name text,
  total_calls bigint,
  offered_amount numeric,
  cash_collected numeric,
  converted_count bigint,
  not_converted_count bigint,
  rescheduled_count bigint,
  pending_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    COUNT(ca.id) as total_calls,
    COALESCE(SUM(ca.offer_amount), 0) as offered_amount,
    COALESCE(SUM(ca.cash_received), 0) as cash_collected,
    COUNT(CASE WHEN ca.status IN ('converted_beginner', 'converted_intermediate', 'converted_advance', 'converted') THEN 1 END) as converted_count,
    COUNT(CASE WHEN ca.status = 'not_converted' THEN 1 END) as not_converted_count,
    COUNT(CASE WHEN ca.status = 'reschedule' THEN 1 END) as rescheduled_count,
    COUNT(CASE WHEN ca.status IN ('scheduled', 'pending', 'not_decided', 'so_so') THEN 1 END) as pending_count
  FROM public.profiles p
  INNER JOIN public.user_roles ur ON ur.user_id = p.id
  LEFT JOIN public.call_appointments ca ON ca.closer_id = p.id AND ca.scheduled_date = target_date
  WHERE ur.role IN ('sales_rep', 'admin')
  GROUP BY p.id, p.full_name
  ORDER BY p.full_name;
END;
$$;