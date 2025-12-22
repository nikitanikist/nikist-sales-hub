-- Drop and recreate get_workshop_metrics to add total_calls_booked column
DROP FUNCTION IF EXISTS public.get_workshop_metrics();

CREATE OR REPLACE FUNCTION public.get_workshop_metrics()
 RETURNS TABLE(workshop_id uuid, registration_count bigint, sales_count bigint, converted_calls bigint, not_converted_calls bigint, rescheduled_remaining bigint, rescheduled_done bigint, remaining_calls bigint, booking_amount_calls bigint, total_offer_amount numeric, total_cash_received numeric, total_calls_booked bigint)
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
    ) as total_cash_received,
    -- Total calls booked: count ALL call_appointments for leads in this workshop (regardless of status)
    (
      SELECT COUNT(DISTINCT ca.id)
      FROM call_appointments ca
      INNER JOIN leads l ON l.id = ca.lead_id
      LEFT JOIN lead_assignments la ON la.lead_id = l.id
      WHERE (l.workshop_name = w.title OR la.workshop_id = w.id)
    ) as total_calls_booked
  FROM workshops w;
$function$;