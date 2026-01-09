-- Drop and recreate get_workshop_metrics function with new refunded_calls column
DROP FUNCTION IF EXISTS public.get_workshop_metrics();

CREATE OR REPLACE FUNCTION public.get_workshop_metrics()
RETURNS TABLE(
  workshop_id uuid,
  registration_count bigint,
  sales_count bigint,
  converted_calls bigint,
  not_converted_calls bigint,
  rescheduled_remaining bigint,
  rescheduled_done bigint,
  remaining_calls bigint,
  booking_amount_calls bigint,
  total_offer_amount numeric,
  total_cash_received numeric,
  total_calls_booked bigint,
  refunded_calls bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT 
    w.id as workshop_id,
    -- Registration count: leads where workshop_name = workshop title
    (SELECT COUNT(*) FROM leads WHERE workshop_name = w.title) as registration_count,
    -- Sales count: leads with BOTH workshop_id assignment AND ₹497 product assignment
    (
      SELECT COUNT(DISTINCT la1.lead_id)
      FROM lead_assignments la1
      INNER JOIN lead_assignments la2 ON la2.lead_id = la1.lead_id
      WHERE la1.workshop_id = w.id
      AND la2.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053'
    ) as sales_count,
    -- Converted calls: ONLY from Workshop Sales (leads with both workshop + product), excluding refunded
    (
      SELECT COUNT(DISTINCT ca.id)
      FROM call_appointments ca
      INNER JOIN leads l ON l.id = ca.lead_id
      WHERE EXISTS (
        SELECT 1 FROM lead_assignments la_ws 
        WHERE la_ws.lead_id = l.id AND la_ws.workshop_id = w.id
      )
      AND EXISTS (
        SELECT 1 FROM lead_assignments la_prod 
        WHERE la_prod.lead_id = l.id AND la_prod.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053'
      )
      AND ca.status IN ('converted_beginner', 'converted_intermediate', 'converted_advance', 'converted')
    ) as converted_calls,
    -- Not converted calls: ONLY from Workshop Sales
    (
      SELECT COUNT(DISTINCT ca.id)
      FROM call_appointments ca
      INNER JOIN leads l ON l.id = ca.lead_id
      WHERE EXISTS (
        SELECT 1 FROM lead_assignments la_ws 
        WHERE la_ws.lead_id = l.id AND la_ws.workshop_id = w.id
      )
      AND EXISTS (
        SELECT 1 FROM lead_assignments la_prod 
        WHERE la_prod.lead_id = l.id AND la_prod.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053'
      )
      AND ca.status = 'not_converted'
    ) as not_converted_calls,
    -- Rescheduled Remaining: ONLY from Workshop Sales
    (
      SELECT COUNT(DISTINCT ca.id)
      FROM call_appointments ca
      INNER JOIN leads l ON l.id = ca.lead_id
      WHERE EXISTS (
        SELECT 1 FROM lead_assignments la_ws 
        WHERE la_ws.lead_id = l.id AND la_ws.workshop_id = w.id
      )
      AND EXISTS (
        SELECT 1 FROM lead_assignments la_prod 
        WHERE la_prod.lead_id = l.id AND la_prod.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053'
      )
      AND ca.status = 'reschedule'
    ) as rescheduled_remaining,
    -- Rescheduled Done: ONLY from Workshop Sales (excluding refunded)
    (
      SELECT COUNT(DISTINCT ca.id)
      FROM call_appointments ca
      INNER JOIN leads l ON l.id = ca.lead_id
      WHERE EXISTS (
        SELECT 1 FROM lead_assignments la_ws 
        WHERE la_ws.lead_id = l.id AND la_ws.workshop_id = w.id
      )
      AND EXISTS (
        SELECT 1 FROM lead_assignments la_prod 
        WHERE la_prod.lead_id = l.id AND la_prod.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053'
      )
      AND ca.was_rescheduled = true
      AND ca.status IN ('converted_beginner', 'converted_intermediate', 'converted_advance', 'converted', 'not_converted', 'booking_amount', 'not_decided', 'so_so')
    ) as rescheduled_done,
    -- Remaining calls: ONLY from Workshop Sales
    (
      SELECT COUNT(DISTINCT ca.id)
      FROM call_appointments ca
      INNER JOIN leads l ON l.id = ca.lead_id
      WHERE EXISTS (
        SELECT 1 FROM lead_assignments la_ws 
        WHERE la_ws.lead_id = l.id AND la_ws.workshop_id = w.id
      )
      AND EXISTS (
        SELECT 1 FROM lead_assignments la_prod 
        WHERE la_prod.lead_id = l.id AND la_prod.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053'
      )
      AND ca.status IN ('scheduled', 'pending', 'not_decided', 'so_so')
    ) as remaining_calls,
    -- Booking amount calls: ONLY from Workshop Sales
    (
      SELECT COUNT(DISTINCT ca.id)
      FROM call_appointments ca
      INNER JOIN leads l ON l.id = ca.lead_id
      WHERE EXISTS (
        SELECT 1 FROM lead_assignments la_ws 
        WHERE la_ws.lead_id = l.id AND la_ws.workshop_id = w.id
      )
      AND EXISTS (
        SELECT 1 FROM lead_assignments la_prod 
        WHERE la_prod.lead_id = l.id AND la_prod.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053'
      )
      AND ca.status = 'booking_amount'
    ) as booking_amount_calls,
    -- Total offer amount: ONLY from Workshop Sales converted/booking calls (excluding refunded)
    (
      SELECT COALESCE(SUM(ca.offer_amount), 0)
      FROM call_appointments ca
      INNER JOIN leads l ON l.id = ca.lead_id
      WHERE EXISTS (
        SELECT 1 FROM lead_assignments la_ws 
        WHERE la_ws.lead_id = l.id AND la_ws.workshop_id = w.id
      )
      AND EXISTS (
        SELECT 1 FROM lead_assignments la_prod 
        WHERE la_prod.lead_id = l.id AND la_prod.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053'
      )
      AND ca.status IN ('converted_beginner', 'converted_intermediate', 'converted_advance', 'converted', 'booking_amount')
    ) as total_offer_amount,
    -- Total cash received: ONLY from Workshop Sales converted/booking calls (excluding refunded)
    (
      SELECT COALESCE(SUM(ca.cash_received), 0)
      FROM call_appointments ca
      INNER JOIN leads l ON l.id = ca.lead_id
      WHERE EXISTS (
        SELECT 1 FROM lead_assignments la_ws 
        WHERE la_ws.lead_id = l.id AND la_ws.workshop_id = w.id
      )
      AND EXISTS (
        SELECT 1 FROM lead_assignments la_prod 
        WHERE la_prod.lead_id = l.id AND la_prod.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053'
      )
      AND ca.status IN ('converted_beginner', 'converted_intermediate', 'converted_advance', 'converted', 'booking_amount')
    ) as total_cash_received,
    -- Total calls booked = Workshop Sales count
    (
      SELECT COUNT(DISTINCT la1.lead_id)
      FROM lead_assignments la1
      INNER JOIN lead_assignments la2 ON la2.lead_id = la1.lead_id
      WHERE la1.workshop_id = w.id
      AND la2.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053'
    ) as total_calls_booked,
    -- Refunded calls: ONLY from Workshop Sales
    (
      SELECT COUNT(DISTINCT ca.id)
      FROM call_appointments ca
      INNER JOIN leads l ON l.id = ca.lead_id
      WHERE EXISTS (
        SELECT 1 FROM lead_assignments la_ws 
        WHERE la_ws.lead_id = l.id AND la_ws.workshop_id = w.id
      )
      AND EXISTS (
        SELECT 1 FROM lead_assignments la_prod 
        WHERE la_prod.lead_id = l.id AND la_prod.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053'
      )
      AND ca.status = 'refunded'
    ) as refunded_calls
  FROM workshops w;
$function$;

-- Update get_workshop_calls_by_category to add 'refunded' category
CREATE OR REPLACE FUNCTION public.get_workshop_calls_by_category(p_workshop_title text, p_category text)
RETURNS TABLE(
  id uuid,
  lead_id uuid,
  scheduled_date date,
  scheduled_time time without time zone,
  status text,
  was_rescheduled boolean,
  offer_amount numeric,
  cash_received numeric,
  closer_name text,
  contact_name text,
  email text,
  phone text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
      (p_category = 'converted' AND ca.status IN ('converted_beginner', 'converted_intermediate', 'converted_advance', 'converted'))
      OR (p_category = 'not_converted' AND ca.status = 'not_converted')
      OR (p_category = 'rescheduled_remaining' AND ca.status = 'reschedule')
      OR (p_category = 'rescheduled_done' AND ca.was_rescheduled = true AND ca.status IN ('converted_beginner', 'converted_intermediate', 'converted_advance', 'converted', 'not_converted', 'booking_amount', 'not_decided', 'so_so'))
      OR (p_category = 'booking_amount' AND ca.status = 'booking_amount')
      OR (p_category = 'remaining' AND ca.status IN ('scheduled', 'pending', 'not_decided', 'so_so'))
      OR (p_category = 'all_booked' AND ca.status IS NOT NULL)
      OR (p_category = 'refunded' AND ca.status = 'refunded')
    )
  ORDER BY ca.id, ca.scheduled_date DESC, ca.scheduled_time DESC;
END;
$function$;