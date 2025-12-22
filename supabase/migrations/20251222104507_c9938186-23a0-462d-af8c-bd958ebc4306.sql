-- Update get_workshop_calls_by_category to check both leads.workshop_name AND lead_assignments.workshop_id
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
    l.workshop_name = p_workshop_title
    OR w.title = p_workshop_title
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

-- Update get_workshop_metrics to check both leads.workshop_name AND lead_assignments.workshop_id
CREATE OR REPLACE FUNCTION public.get_workshop_metrics()
RETURNS TABLE(workshop_id uuid, registration_count bigint, sales_count bigint, converted_calls bigint, not_converted_calls bigint, rescheduled_remaining bigint, rescheduled_done bigint, remaining_calls bigint, booking_amount_calls bigint, total_offer_amount numeric, total_cash_received numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    ) as sales_count,
    -- Converted calls: count of call_appointments with converted_* status for leads in this workshop
    (
      SELECT COUNT(DISTINCT ca.id)
      FROM call_appointments ca
      INNER JOIN leads l ON l.id = ca.lead_id
      LEFT JOIN lead_assignments la ON la.lead_id = l.id
      WHERE (l.workshop_name = w.title OR la.workshop_id = w.id)
      AND ca.status IN ('converted_beginner', 'converted_intermediate', 'converted_advance')
    ) as converted_calls,
    -- Not converted calls
    (
      SELECT COUNT(DISTINCT ca.id)
      FROM call_appointments ca
      INNER JOIN leads l ON l.id = ca.lead_id
      LEFT JOIN lead_assignments la ON la.lead_id = l.id
      WHERE (l.workshop_name = w.title OR la.workshop_id = w.id)
      AND ca.status = 'not_converted'
    ) as not_converted_calls,
    -- Rescheduled Remaining: calls with status = 'reschedule' (still pending)
    (
      SELECT COUNT(DISTINCT ca.id)
      FROM call_appointments ca
      INNER JOIN leads l ON l.id = ca.lead_id
      LEFT JOIN lead_assignments la ON la.lead_id = l.id
      WHERE (l.workshop_name = w.title OR la.workshop_id = w.id)
      AND ca.status = 'reschedule'
    ) as rescheduled_remaining,
    -- Rescheduled Done: calls that were rescheduled but now completed
    (
      SELECT COUNT(DISTINCT ca.id)
      FROM call_appointments ca
      INNER JOIN leads l ON l.id = ca.lead_id
      LEFT JOIN lead_assignments la ON la.lead_id = l.id
      WHERE (l.workshop_name = w.title OR la.workshop_id = w.id)
      AND ca.was_rescheduled = true
      AND ca.status IN ('converted_beginner', 'converted_intermediate', 'converted_advance', 'not_converted', 'booking_amount', 'refunded')
    ) as rescheduled_done,
    -- Remaining calls (scheduled or pending - not yet handled)
    (
      SELECT COUNT(DISTINCT ca.id)
      FROM call_appointments ca
      INNER JOIN leads l ON l.id = ca.lead_id
      LEFT JOIN lead_assignments la ON la.lead_id = l.id
      WHERE (l.workshop_name = w.title OR la.workshop_id = w.id)
      AND ca.status IN ('scheduled', 'pending', 'not_decided', 'so_so')
    ) as remaining_calls,
    -- Booking amount calls
    (
      SELECT COUNT(DISTINCT ca.id)
      FROM call_appointments ca
      INNER JOIN leads l ON l.id = ca.lead_id
      LEFT JOIN lead_assignments la ON la.lead_id = l.id
      WHERE (l.workshop_name = w.title OR la.workshop_id = w.id)
      AND ca.status = 'booking_amount'
    ) as booking_amount_calls,
    -- Total offer amount from converted calls
    (
      SELECT COALESCE(SUM(ca.offer_amount), 0)
      FROM call_appointments ca
      INNER JOIN leads l ON l.id = ca.lead_id
      LEFT JOIN lead_assignments la ON la.lead_id = l.id
      WHERE (l.workshop_name = w.title OR la.workshop_id = w.id)
      AND ca.status IN ('converted_beginner', 'converted_intermediate', 'converted_advance')
    ) as total_offer_amount,
    -- Total cash received from converted calls
    (
      SELECT COALESCE(SUM(ca.cash_received), 0)
      FROM call_appointments ca
      INNER JOIN leads l ON l.id = ca.lead_id
      LEFT JOIN lead_assignments la ON la.lead_id = l.id
      WHERE (l.workshop_name = w.title OR la.workshop_id = w.id)
      AND ca.status IN ('converted_beginner', 'converted_intermediate', 'converted_advance')
    ) as total_cash_received
  FROM workshops w;
$function$;