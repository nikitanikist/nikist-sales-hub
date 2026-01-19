-- Drop and recreate get_workshop_calls_by_category with rejoin and cross_workshop categories
DROP FUNCTION IF EXISTS public.get_workshop_calls_by_category(text, text);

CREATE OR REPLACE FUNCTION public.get_workshop_calls_by_category(p_workshop_title text, p_category text)
 RETURNS TABLE(id uuid, lead_id uuid, scheduled_date date, scheduled_time time without time zone, status text, was_rescheduled boolean, offer_amount numeric, cash_received numeric, closer_name text, contact_name text, email text, phone text, original_workshop_title text, payment_workshop_title text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_workshop_id uuid;
BEGIN
  SELECT w.id INTO v_workshop_id FROM workshops w WHERE w.title = p_workshop_title LIMIT 1;
  
  -- REJOIN: Leads whose first workshop is THIS one, but paid in a DIFFERENT workshop
  IF p_category = 'rejoin' THEN
    RETURN QUERY
    WITH lead_first_workshop AS (
      SELECT DISTINCT ON (la.lead_id)
        la.lead_id,
        la.workshop_id as first_workshop_id,
        la.created_at as first_workshop_date
      FROM lead_assignments la
      WHERE la.workshop_id IS NOT NULL
      ORDER BY la.lead_id, la.created_at ASC
    ),
    lead_product_assignment AS (
      SELECT 
        la.lead_id,
        la.created_at as product_date
      FROM lead_assignments la
      WHERE la.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053'
    ),
    workshop_lead_classification AS (
      SELECT 
        lfw.lead_id,
        lfw.first_workshop_id,
        (
          SELECT la2.workshop_id 
          FROM lead_assignments la2 
          WHERE la2.lead_id = lfw.lead_id 
            AND la2.workshop_id IS NOT NULL
            AND la2.created_at <= lpa.product_date + interval '1 minute'
          ORDER BY la2.created_at DESC 
          LIMIT 1
        ) as payment_context_workshop_id
      FROM lead_first_workshop lfw
      INNER JOIN lead_product_assignment lpa ON lpa.lead_id = lfw.lead_id
    )
    SELECT DISTINCT ON (COALESCE(ca.id, l.id))
      COALESCE(ca.id, l.id) as id,
      l.id as lead_id,
      ca.scheduled_date,
      ca.scheduled_time,
      COALESCE(ca.status::TEXT, 'no_call') as status,
      COALESCE(ca.was_rescheduled, false) as was_rescheduled,
      ca.offer_amount,
      ca.cash_received,
      p.full_name as closer_name,
      l.contact_name,
      l.email,
      l.phone,
      NULL::text as original_workshop_title,
      pw.title as payment_workshop_title
    FROM workshop_lead_classification wlc
    INNER JOIN leads l ON l.id = wlc.lead_id
    LEFT JOIN call_appointments ca ON ca.lead_id = l.id
    LEFT JOIN profiles p ON p.id = ca.closer_id
    LEFT JOIN workshops pw ON pw.id = wlc.payment_context_workshop_id
    WHERE wlc.first_workshop_id = v_workshop_id
      AND wlc.payment_context_workshop_id IS NOT NULL
      AND wlc.payment_context_workshop_id != v_workshop_id
    ORDER BY COALESCE(ca.id, l.id), ca.scheduled_date DESC NULLS LAST;
  
  -- CROSS-WORKSHOP: Leads whose first workshop is DIFFERENT, but paid in THIS workshop  
  ELSIF p_category = 'cross_workshop' THEN
    RETURN QUERY
    WITH lead_first_workshop AS (
      SELECT DISTINCT ON (la.lead_id)
        la.lead_id,
        la.workshop_id as first_workshop_id,
        la.created_at as first_workshop_date
      FROM lead_assignments la
      WHERE la.workshop_id IS NOT NULL
      ORDER BY la.lead_id, la.created_at ASC
    ),
    lead_product_assignment AS (
      SELECT 
        la.lead_id,
        la.created_at as product_date
      FROM lead_assignments la
      WHERE la.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053'
    ),
    workshop_lead_classification AS (
      SELECT 
        lfw.lead_id,
        lfw.first_workshop_id,
        (
          SELECT la2.workshop_id 
          FROM lead_assignments la2 
          WHERE la2.lead_id = lfw.lead_id 
            AND la2.workshop_id IS NOT NULL
            AND la2.created_at <= lpa.product_date + interval '1 minute'
          ORDER BY la2.created_at DESC 
          LIMIT 1
        ) as payment_context_workshop_id
      FROM lead_first_workshop lfw
      INNER JOIN lead_product_assignment lpa ON lpa.lead_id = lfw.lead_id
    )
    SELECT DISTINCT ON (COALESCE(ca.id, l.id))
      COALESCE(ca.id, l.id) as id,
      l.id as lead_id,
      ca.scheduled_date,
      ca.scheduled_time,
      COALESCE(ca.status::TEXT, 'no_call') as status,
      COALESCE(ca.was_rescheduled, false) as was_rescheduled,
      ca.offer_amount,
      ca.cash_received,
      p.full_name as closer_name,
      l.contact_name,
      l.email,
      l.phone,
      ow.title as original_workshop_title,
      NULL::text as payment_workshop_title
    FROM workshop_lead_classification wlc
    INNER JOIN leads l ON l.id = wlc.lead_id
    LEFT JOIN call_appointments ca ON ca.lead_id = l.id
    LEFT JOIN profiles p ON p.id = ca.closer_id
    LEFT JOIN workshops ow ON ow.id = wlc.first_workshop_id
    WHERE wlc.first_workshop_id != v_workshop_id
      AND wlc.payment_context_workshop_id = v_workshop_id
    ORDER BY COALESCE(ca.id, l.id), ca.scheduled_date DESC NULLS LAST;
    
  -- REFUNDED category  
  ELSIF p_category = 'refunded' THEN
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
      l.phone,
      NULL::text as original_workshop_title,
      NULL::text as payment_workshop_title
    FROM call_appointments ca
    INNER JOIN leads l ON l.id = ca.lead_id
    LEFT JOIN profiles p ON p.id = ca.closer_id
    WHERE 
      EXISTS (SELECT 1 FROM lead_assignments la_ws WHERE la_ws.lead_id = l.id AND la_ws.workshop_id = v_workshop_id)
      AND EXISTS (SELECT 1 FROM lead_assignments la_prod WHERE la_prod.lead_id = l.id AND la_prod.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053')
      AND ca.status = 'refunded'
    
    UNION
    
    SELECT DISTINCT ON (l.id)
      la_prod.id as id,
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
      l.phone,
      NULL::text as original_workshop_title,
      NULL::text as payment_workshop_title
    FROM leads l
    INNER JOIN lead_assignments la_ws ON la_ws.lead_id = l.id AND la_ws.workshop_id = v_workshop_id
    INNER JOIN lead_assignments la_prod ON la_prod.lead_id = l.id 
      AND la_prod.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053'
      AND la_prod.is_refunded = true
    WHERE 
      NOT EXISTS (SELECT 1 FROM call_appointments ca WHERE ca.lead_id = l.id AND ca.status = 'refunded');
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
      l.phone,
      NULL::text as original_workshop_title,
      NULL::text as payment_workshop_title
    FROM call_appointments ca
    INNER JOIN leads l ON l.id = ca.lead_id
    LEFT JOIN profiles p ON p.id = ca.closer_id
    WHERE 
      EXISTS (SELECT 1 FROM lead_assignments la_ws WHERE la_ws.lead_id = l.id AND la_ws.workshop_id = v_workshop_id)
      AND EXISTS (SELECT 1 FROM lead_assignments la_prod WHERE la_prod.lead_id = l.id AND la_prod.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053')
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