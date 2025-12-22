
-- Create RPC function to get workshop calls by category with server-side joins
CREATE OR REPLACE FUNCTION public.get_workshop_calls_by_category(
  p_workshop_title TEXT,
  p_category TEXT
)
RETURNS TABLE (
  id UUID,
  lead_id UUID,
  scheduled_date DATE,
  scheduled_time TIME,
  status TEXT,
  was_rescheduled BOOLEAN,
  offer_amount NUMERIC,
  cash_received NUMERIC,
  closer_name TEXT,
  contact_name TEXT,
  email TEXT,
  phone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ca.id,
    ca.lead_id,
    ca.scheduled_date,
    ca.scheduled_time,
    ca.status::TEXT,
    ca.was_rescheduled,
    ca.offer_amount,
    ca.cash_received,
    p.full_name as closer_name,
    l.contact_name,
    l.email,
    l.phone
  FROM call_appointments ca
  INNER JOIN leads l ON l.id = ca.lead_id
  LEFT JOIN profiles p ON p.id = ca.closer_id
  WHERE l.workshop_name = p_workshop_title
  AND (
    (p_category = 'converted' AND ca.status IN ('converted_beginner', 'converted_intermediate', 'converted_advance'))
    OR (p_category = 'not_converted' AND ca.status = 'not_converted')
    OR (p_category = 'rescheduled_remaining' AND ca.status = 'reschedule')
    OR (p_category = 'rescheduled_done' AND ca.was_rescheduled = true AND ca.status IN ('converted_beginner', 'converted_intermediate', 'converted_advance', 'not_converted', 'booking_amount', 'refunded'))
    OR (p_category = 'booking_amount' AND ca.status = 'booking_amount')
    OR (p_category = 'remaining' AND ca.status IN ('scheduled', 'pending', 'not_decided', 'so_so'))
  )
  ORDER BY ca.scheduled_date DESC, ca.scheduled_time DESC;
END;
$$;
