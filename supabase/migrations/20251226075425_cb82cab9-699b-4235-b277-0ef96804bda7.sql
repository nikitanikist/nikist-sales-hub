CREATE OR REPLACE FUNCTION public.get_workshop_calls_by_category(p_workshop_title text, p_category text)
 RETURNS TABLE(id uuid, lead_id uuid, scheduled_date date, scheduled_time time without time zone, status text, was_rescheduled boolean, offer_amount numeric, cash_received numeric, closer_name text, contact_name text, email text, phone text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_workshop_id uuid;
BEGIN
  -- Get the workshop ID from the title
  SELECT w.id INTO v_workshop_id FROM workshops w WHERE w.title = p_workshop_title LIMIT 1;
  
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
  LEFT JOIN profiles p ON p.id = ca.closer_id
  WHERE 
    -- Must have workshop assignment for this workshop
    EXISTS (
      SELECT 1 FROM lead_assignments la_ws 
      WHERE la_ws.lead_id = l.id AND la_ws.workshop_id = v_workshop_id
    )
    -- Must have ₹497 product assignment (Workshop Sales)
    AND EXISTS (
      SELECT 1 FROM lead_assignments la_prod 
      WHERE la_prod.lead_id = l.id AND la_prod.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053'
    )
    -- Filter by category
    AND (
      (p_category = 'converted' AND ca.status IN ('converted_beginner', 'converted_intermediate', 'converted_advance'))
      OR (p_category = 'not_converted' AND ca.status = 'not_converted')
      OR (p_category = 'rescheduled_remaining' AND ca.status = 'reschedule')
      OR (p_category = 'rescheduled_done' AND ca.was_rescheduled = true AND ca.status IN ('converted_beginner', 'converted_intermediate', 'converted_advance', 'not_converted', 'booking_amount', 'refunded'))
      OR (p_category = 'booking_amount' AND ca.status = 'booking_amount')
      OR (p_category = 'remaining' AND ca.status IN ('scheduled', 'pending', 'not_decided', 'so_so'))
      OR (p_category = 'all_booked' AND ca.status IS NOT NULL)
    )
  ORDER BY ca.id, ca.scheduled_date DESC, ca.scheduled_time DESC;
END;
$function$;