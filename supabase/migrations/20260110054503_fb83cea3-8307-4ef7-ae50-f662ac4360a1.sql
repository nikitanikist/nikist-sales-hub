
-- Update get_workshop_metrics to include assignment-level refunds
CREATE OR REPLACE FUNCTION public.get_workshop_metrics()
 RETURNS TABLE(workshop_id uuid, registration_count bigint, sales_count bigint, converted_calls bigint, not_converted_calls bigint, rescheduled_remaining bigint, rescheduled_done bigint, remaining_calls bigint, booking_amount_calls bigint, total_offer_amount numeric, total_cash_received numeric, total_calls_booked bigint, refunded_calls bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
    -- Refunded: includes BOTH call_appointments.status = 'refunded' AND lead_assignments.is_refunded = true
    (
      SELECT COUNT(DISTINCT l.id)
      FROM leads l
      WHERE EXISTS (
        SELECT 1 FROM lead_assignments la_ws 
        WHERE la_ws.lead_id = l.id AND la_ws.workshop_id = w.id
      )
      AND EXISTS (
        SELECT 1 FROM lead_assignments la_prod 
        WHERE la_prod.lead_id = l.id 
        AND la_prod.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053'
        AND (
          -- Either the product assignment itself is refunded
          la_prod.is_refunded = true
          -- Or they have a call appointment with refunded status
          OR EXISTS (
            SELECT 1 FROM call_appointments ca 
            WHERE ca.lead_id = l.id AND ca.status = 'refunded'
          )
        )
      )
    ) as refunded_calls
  FROM workshops w;
$function$;

-- Update get_workshop_calls_by_category to include assignment-level refunds for 'refunded' category
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
  
  -- For refunded category, we need to include both call-level and assignment-level refunds
  IF p_category = 'refunded' THEN
    RETURN QUERY
    -- Part 1: Leads with call_appointments.status = 'refunded'
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
      EXISTS (
        SELECT 1 FROM lead_assignments la_ws 
        WHERE la_ws.lead_id = l.id AND la_ws.workshop_id = v_workshop_id
      )
      AND EXISTS (
        SELECT 1 FROM lead_assignments la_prod 
        WHERE la_prod.lead_id = l.id AND la_prod.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053'
      )
      AND ca.status = 'refunded'
    
    UNION
    
    -- Part 2: Leads with lead_assignments.is_refunded = true (no call or non-refunded call)
    SELECT DISTINCT ON (l.id)
      la_prod.id as id,  -- Use assignment id as fallback
      l.id as lead_id,
      NULL::date as scheduled_date,
      NULL::time as scheduled_time,
      'refunded'::TEXT as status,
      false as was_rescheduled,
      NULL::numeric as offer_amount,
      NULL::numeric as cash_received,
      NULL::text as closer_name,
      l.contact_name,
      l.email,
      l.phone
    FROM leads l
    INNER JOIN lead_assignments la_ws ON la_ws.lead_id = l.id AND la_ws.workshop_id = v_workshop_id
    INNER JOIN lead_assignments la_prod ON la_prod.lead_id = l.id 
      AND la_prod.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053'
      AND la_prod.is_refunded = true
    WHERE 
      -- Exclude those already counted in Part 1 (have a refunded call)
      NOT EXISTS (
        SELECT 1 FROM call_appointments ca 
        WHERE ca.lead_id = l.id AND ca.status = 'refunded'
      );
  ELSE
    -- Original logic for other categories
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
      )
    ORDER BY ca.id, ca.scheduled_date DESC, ca.scheduled_time DESC;
  END IF;
END;
$function$;
