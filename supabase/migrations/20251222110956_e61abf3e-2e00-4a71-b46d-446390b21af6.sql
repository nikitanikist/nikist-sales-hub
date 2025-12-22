
-- Update get_workshop_calls_by_category to prioritize lead_assignments.workshop_id over leads.workshop_name
CREATE OR REPLACE FUNCTION public.get_workshop_calls_by_category(p_workshop_title text, p_category text)
 RETURNS TABLE(id uuid, lead_id uuid, scheduled_date date, scheduled_time time without time zone, status text, was_rescheduled boolean, offer_amount numeric, cash_received numeric, closer_name text, contact_name text, email text, phone text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (ca.id)
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
  LEFT JOIN lead_assignments la ON la.lead_id = l.id
  LEFT JOIN workshops w ON w.id = la.workshop_id
  LEFT JOIN profiles p ON p.id = ca.closer_id
  WHERE (
    -- PRIORITY 1: Use lead_assignment.workshop_id if it exists
    (la.workshop_id IS NOT NULL AND w.title = p_workshop_title)
    OR
    -- PRIORITY 2: Fall back to leads.workshop_name only if NO workshop assignment exists
    (NOT EXISTS (
      SELECT 1 FROM lead_assignments la2 
      WHERE la2.lead_id = l.id AND la2.workshop_id IS NOT NULL
    ) AND l.workshop_name = p_workshop_title)
  )
  AND (
    (p_category = 'converted' AND ca.status IN ('converted_beginner', 'converted_intermediate', 'converted_advance'))
    OR (p_category = 'not_converted' AND ca.status = 'not_converted')
    OR (p_category = 'rescheduled_remaining' AND ca.status = 'reschedule')
    OR (p_category = 'rescheduled_done' AND ca.was_rescheduled = true AND ca.status IN ('converted_beginner', 'converted_intermediate', 'converted_advance', 'not_converted', 'booking_amount', 'refunded'))
    OR (p_category = 'booking_amount' AND ca.status = 'booking_amount')
    OR (p_category = 'remaining' AND ca.status IN ('scheduled', 'pending', 'not_decided', 'so_so'))
  )
  ORDER BY ca.id, ca.scheduled_date DESC, ca.scheduled_time DESC;
END;
$function$;
