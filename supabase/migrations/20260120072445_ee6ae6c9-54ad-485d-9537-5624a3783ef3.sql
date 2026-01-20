
-- Update get_workshop_metrics to use mango_id and workshop.start_date for rejoin attribution
CREATE OR REPLACE FUNCTION public.get_workshop_metrics()
 RETURNS TABLE(workshop_id uuid, registration_count bigint, sales_count bigint, converted_calls bigint, not_converted_calls bigint, rescheduled_remaining bigint, rescheduled_done bigint, remaining_calls bigint, booking_amount_calls bigint, total_offer_amount numeric, total_cash_received numeric, total_calls_booked bigint, refunded_calls bigint, fresh_sales_count bigint, fresh_converted bigint, fresh_not_converted bigint, fresh_remaining bigint, fresh_rescheduled_remaining bigint, fresh_rescheduled_done bigint, fresh_booking_amount bigint, fresh_offer_amount numeric, fresh_cash_received numeric, rejoin_sales_count bigint, rejoin_converted bigint, rejoin_not_converted bigint, rejoin_remaining bigint, rejoin_rescheduled_remaining bigint, rejoin_rescheduled_done bigint, rejoin_booking_amount bigint, rejoin_offer_amount numeric, rejoin_cash_received numeric, cross_workshop_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH lead_workshop_assignments AS (
    SELECT 
      la.lead_id,
      la.workshop_id,
      la.created_at as assignment_created_at,
      w.mango_id,
      w.start_date as workshop_start_date
    FROM lead_assignments la
    INNER JOIN workshops w ON w.id = la.workshop_id
    WHERE la.workshop_id IS NOT NULL
  ),
  lead_first_workshop AS (
    SELECT DISTINCT ON (lwa.lead_id, lwa.mango_id)
      lwa.lead_id,
      lwa.mango_id,
      lwa.workshop_id as first_workshop_id,
      lwa.workshop_start_date as first_workshop_date
    FROM lead_workshop_assignments lwa
    WHERE lwa.mango_id IS NOT NULL
    ORDER BY lwa.lead_id, lwa.mango_id, lwa.workshop_start_date ASC, lwa.assignment_created_at ASC
  ),
  lead_product_assignment AS (
    SELECT 
      la.lead_id,
      la.created_at as product_date,
      la.workshop_id as payment_workshop_id
    FROM lead_assignments la
    WHERE la.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053'
  ),
  workshop_lead_classification AS (
    SELECT 
      lfw.lead_id,
      lfw.mango_id,
      lfw.first_workshop_id,
      lfw.first_workshop_date,
      lpa.product_date,
      lpa.payment_workshop_id,
      (
        SELECT lwa2.workshop_id 
        FROM lead_workshop_assignments lwa2 
        WHERE lwa2.lead_id = lfw.lead_id 
          AND lwa2.mango_id = lfw.mango_id
          AND lwa2.assignment_created_at <= lpa.product_date + interval '1 minute'
        ORDER BY lwa2.assignment_created_at DESC 
        LIMIT 1
      ) as payment_context_workshop_id
    FROM lead_first_workshop lfw
    INNER JOIN lead_product_assignment lpa ON lpa.lead_id = lfw.lead_id
  )
  SELECT 
    w.id as workshop_id,
    (SELECT COUNT(*) FROM leads WHERE workshop_name = w.title) as registration_count,
    (
      SELECT COUNT(DISTINCT la1.lead_id)
      FROM lead_assignments la1
      INNER JOIN lead_assignments la2 ON la2.lead_id = la1.lead_id
      WHERE la1.workshop_id = w.id
      AND la2.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053'
    ) as sales_count,
    (
      SELECT COUNT(DISTINCT ca.id)
      FROM call_appointments ca
      INNER JOIN leads l ON l.id = ca.lead_id
      WHERE EXISTS (SELECT 1 FROM lead_assignments la_ws WHERE la_ws.lead_id = l.id AND la_ws.workshop_id = w.id)
      AND EXISTS (SELECT 1 FROM lead_assignments la_prod WHERE la_prod.lead_id = l.id AND la_prod.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053')
      AND ca.status IN ('converted_beginner', 'converted_intermediate', 'converted_advance', 'converted')
    ) as converted_calls,
    (
      SELECT COUNT(DISTINCT ca.id)
      FROM call_appointments ca
      INNER JOIN leads l ON l.id = ca.lead_id
      WHERE EXISTS (SELECT 1 FROM lead_assignments la_ws WHERE la_ws.lead_id = l.id AND la_ws.workshop_id = w.id)
      AND EXISTS (SELECT 1 FROM lead_assignments la_prod WHERE la_prod.lead_id = l.id AND la_prod.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053')
      AND ca.status = 'not_converted'
    ) as not_converted_calls,
    (
      SELECT COUNT(DISTINCT ca.id)
      FROM call_appointments ca
      INNER JOIN leads l ON l.id = ca.lead_id
      WHERE EXISTS (SELECT 1 FROM lead_assignments la_ws WHERE la_ws.lead_id = l.id AND la_ws.workshop_id = w.id)
      AND EXISTS (SELECT 1 FROM lead_assignments la_prod WHERE la_prod.lead_id = l.id AND la_prod.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053')
      AND ca.status = 'reschedule'
    ) as rescheduled_remaining,
    (
      SELECT COUNT(DISTINCT ca.id)
      FROM call_appointments ca
      INNER JOIN leads l ON l.id = ca.lead_id
      WHERE EXISTS (SELECT 1 FROM lead_assignments la_ws WHERE la_ws.lead_id = l.id AND la_ws.workshop_id = w.id)
      AND EXISTS (SELECT 1 FROM lead_assignments la_prod WHERE la_prod.lead_id = l.id AND la_prod.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053')
      AND ca.was_rescheduled = true
      AND ca.status IN ('converted_beginner', 'converted_intermediate', 'converted_advance', 'converted', 'not_converted', 'booking_amount', 'not_decided', 'so_so')
    ) as rescheduled_done,
    (
      SELECT COUNT(DISTINCT ca.id)
      FROM call_appointments ca
      INNER JOIN leads l ON l.id = ca.lead_id
      WHERE EXISTS (SELECT 1 FROM lead_assignments la_ws WHERE la_ws.lead_id = l.id AND la_ws.workshop_id = w.id)
      AND EXISTS (SELECT 1 FROM lead_assignments la_prod WHERE la_prod.lead_id = l.id AND la_prod.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053')
      AND ca.status IN ('scheduled', 'pending', 'not_decided', 'so_so')
    ) as remaining_calls,
    (
      SELECT COUNT(DISTINCT ca.id)
      FROM call_appointments ca
      INNER JOIN leads l ON l.id = ca.lead_id
      WHERE EXISTS (SELECT 1 FROM lead_assignments la_ws WHERE la_ws.lead_id = l.id AND la_ws.workshop_id = w.id)
      AND EXISTS (SELECT 1 FROM lead_assignments la_prod WHERE la_prod.lead_id = l.id AND la_prod.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053')
      AND ca.status = 'booking_amount'
    ) as booking_amount_calls,
    (
      SELECT COALESCE(SUM(ca.offer_amount), 0)
      FROM call_appointments ca
      INNER JOIN leads l ON l.id = ca.lead_id
      WHERE EXISTS (SELECT 1 FROM lead_assignments la_ws WHERE la_ws.lead_id = l.id AND la_ws.workshop_id = w.id)
      AND EXISTS (SELECT 1 FROM lead_assignments la_prod WHERE la_prod.lead_id = l.id AND la_prod.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053')
      AND ca.status IN ('converted_beginner', 'converted_intermediate', 'converted_advance', 'converted', 'booking_amount')
    ) as total_offer_amount,
    (
      SELECT COALESCE(SUM(ca.cash_received), 0)
      FROM call_appointments ca
      INNER JOIN leads l ON l.id = ca.lead_id
      WHERE EXISTS (SELECT 1 FROM lead_assignments la_ws WHERE la_ws.lead_id = l.id AND la_ws.workshop_id = w.id)
      AND EXISTS (SELECT 1 FROM lead_assignments la_prod WHERE la_prod.lead_id = l.id AND la_prod.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053')
      AND ca.status IN ('converted_beginner', 'converted_intermediate', 'converted_advance', 'converted', 'booking_amount')
    ) as total_cash_received,
    (
      SELECT COUNT(DISTINCT la1.lead_id)
      FROM lead_assignments la1
      INNER JOIN lead_assignments la2 ON la2.lead_id = la1.lead_id
      WHERE la1.workshop_id = w.id
      AND la2.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053'
    ) as total_calls_booked,
    (
      SELECT COUNT(DISTINCT l.id)
      FROM leads l
      WHERE EXISTS (SELECT 1 FROM lead_assignments la_ws WHERE la_ws.lead_id = l.id AND la_ws.workshop_id = w.id)
      AND EXISTS (
        SELECT 1 FROM lead_assignments la_prod 
        WHERE la_prod.lead_id = l.id 
        AND la_prod.product_id = 'b8709b0b-1160-4d73-b59b-2849490d2053'
        AND (la_prod.is_refunded = true OR EXISTS (SELECT 1 FROM call_appointments ca WHERE ca.lead_id = l.id AND ca.status = 'refunded'))
      )
    ) as refunded_calls,
    (SELECT COUNT(DISTINCT wlc.lead_id) FROM workshop_lead_classification wlc WHERE wlc.first_workshop_id = w.id AND wlc.product_date IS NOT NULL AND (wlc.payment_context_workshop_id = w.id OR wlc.payment_context_workshop_id IS NULL)) as fresh_sales_count,
    (SELECT COUNT(DISTINCT ca.id) FROM call_appointments ca INNER JOIN workshop_lead_classification wlc ON wlc.lead_id = ca.lead_id WHERE wlc.first_workshop_id = w.id AND wlc.product_date IS NOT NULL AND (wlc.payment_context_workshop_id = w.id OR wlc.payment_context_workshop_id IS NULL) AND ca.status IN ('converted_beginner', 'converted_intermediate', 'converted_advance', 'converted')) as fresh_converted,
    (SELECT COUNT(DISTINCT ca.id) FROM call_appointments ca INNER JOIN workshop_lead_classification wlc ON wlc.lead_id = ca.lead_id WHERE wlc.first_workshop_id = w.id AND wlc.product_date IS NOT NULL AND (wlc.payment_context_workshop_id = w.id OR wlc.payment_context_workshop_id IS NULL) AND ca.status = 'not_converted') as fresh_not_converted,
    (SELECT COUNT(DISTINCT ca.id) FROM call_appointments ca INNER JOIN workshop_lead_classification wlc ON wlc.lead_id = ca.lead_id WHERE wlc.first_workshop_id = w.id AND wlc.product_date IS NOT NULL AND (wlc.payment_context_workshop_id = w.id OR wlc.payment_context_workshop_id IS NULL) AND ca.status IN ('scheduled', 'pending', 'not_decided', 'so_so')) as fresh_remaining,
    (SELECT COUNT(DISTINCT ca.id) FROM call_appointments ca INNER JOIN workshop_lead_classification wlc ON wlc.lead_id = ca.lead_id WHERE wlc.first_workshop_id = w.id AND wlc.product_date IS NOT NULL AND (wlc.payment_context_workshop_id = w.id OR wlc.payment_context_workshop_id IS NULL) AND ca.status = 'reschedule') as fresh_rescheduled_remaining,
    (SELECT COUNT(DISTINCT ca.id) FROM call_appointments ca INNER JOIN workshop_lead_classification wlc ON wlc.lead_id = ca.lead_id WHERE wlc.first_workshop_id = w.id AND wlc.product_date IS NOT NULL AND (wlc.payment_context_workshop_id = w.id OR wlc.payment_context_workshop_id IS NULL) AND ca.was_rescheduled = true AND ca.status IN ('converted_beginner', 'converted_intermediate', 'converted_advance', 'converted', 'not_converted', 'booking_amount', 'not_decided', 'so_so')) as fresh_rescheduled_done,
    (SELECT COUNT(DISTINCT ca.id) FROM call_appointments ca INNER JOIN workshop_lead_classification wlc ON wlc.lead_id = ca.lead_id WHERE wlc.first_workshop_id = w.id AND wlc.product_date IS NOT NULL AND (wlc.payment_context_workshop_id = w.id OR wlc.payment_context_workshop_id IS NULL) AND ca.status = 'booking_amount') as fresh_booking_amount,
    (SELECT COALESCE(SUM(ca.offer_amount), 0) FROM call_appointments ca INNER JOIN workshop_lead_classification wlc ON wlc.lead_id = ca.lead_id WHERE wlc.first_workshop_id = w.id AND wlc.product_date IS NOT NULL AND (wlc.payment_context_workshop_id = w.id OR wlc.payment_context_workshop_id IS NULL) AND ca.status IN ('converted_beginner', 'converted_intermediate', 'converted_advance', 'converted', 'booking_amount')) as fresh_offer_amount,
    (SELECT COALESCE(SUM(ca.cash_received), 0) FROM call_appointments ca INNER JOIN workshop_lead_classification wlc ON wlc.lead_id = ca.lead_id WHERE wlc.first_workshop_id = w.id AND wlc.product_date IS NOT NULL AND (wlc.payment_context_workshop_id = w.id OR wlc.payment_context_workshop_id IS NULL) AND ca.status IN ('converted_beginner', 'converted_intermediate', 'converted_advance', 'converted', 'booking_amount')) as fresh_cash_received,
    (SELECT COUNT(DISTINCT wlc.lead_id) FROM workshop_lead_classification wlc WHERE wlc.first_workshop_id = w.id AND wlc.product_date IS NOT NULL AND wlc.payment_context_workshop_id IS NOT NULL AND wlc.payment_context_workshop_id != w.id) as rejoin_sales_count,
    (SELECT COUNT(DISTINCT ca.id) FROM call_appointments ca INNER JOIN workshop_lead_classification wlc ON wlc.lead_id = ca.lead_id WHERE wlc.first_workshop_id = w.id AND wlc.product_date IS NOT NULL AND wlc.payment_context_workshop_id IS NOT NULL AND wlc.payment_context_workshop_id != w.id AND ca.status IN ('converted_beginner', 'converted_intermediate', 'converted_advance', 'converted')) as rejoin_converted,
    (SELECT COUNT(DISTINCT ca.id) FROM call_appointments ca INNER JOIN workshop_lead_classification wlc ON wlc.lead_id = ca.lead_id WHERE wlc.first_workshop_id = w.id AND wlc.product_date IS NOT NULL AND wlc.payment_context_workshop_id IS NOT NULL AND wlc.payment_context_workshop_id != w.id AND ca.status = 'not_converted') as rejoin_not_converted,
    (SELECT COUNT(DISTINCT ca.id) FROM call_appointments ca INNER JOIN workshop_lead_classification wlc ON wlc.lead_id = ca.lead_id WHERE wlc.first_workshop_id = w.id AND wlc.product_date IS NOT NULL AND wlc.payment_context_workshop_id IS NOT NULL AND wlc.payment_context_workshop_id != w.id AND ca.status IN ('scheduled', 'pending', 'not_decided', 'so_so')) as rejoin_remaining,
    (SELECT COUNT(DISTINCT ca.id) FROM call_appointments ca INNER JOIN workshop_lead_classification wlc ON wlc.lead_id = ca.lead_id WHERE wlc.first_workshop_id = w.id AND wlc.product_date IS NOT NULL AND wlc.payment_context_workshop_id IS NOT NULL AND wlc.payment_context_workshop_id != w.id AND ca.status = 'reschedule') as rejoin_rescheduled_remaining,
    (SELECT COUNT(DISTINCT ca.id) FROM call_appointments ca INNER JOIN workshop_lead_classification wlc ON wlc.lead_id = ca.lead_id WHERE wlc.first_workshop_id = w.id AND wlc.product_date IS NOT NULL AND wlc.payment_context_workshop_id IS NOT NULL AND wlc.payment_context_workshop_id != w.id AND ca.was_rescheduled = true AND ca.status IN ('converted_beginner', 'converted_intermediate', 'converted_advance', 'converted', 'not_converted', 'booking_amount', 'not_decided', 'so_so')) as rejoin_rescheduled_done,
    (SELECT COUNT(DISTINCT ca.id) FROM call_appointments ca INNER JOIN workshop_lead_classification wlc ON wlc.lead_id = ca.lead_id WHERE wlc.first_workshop_id = w.id AND wlc.product_date IS NOT NULL AND wlc.payment_context_workshop_id IS NOT NULL AND wlc.payment_context_workshop_id != w.id AND ca.status = 'booking_amount') as rejoin_booking_amount,
    (SELECT COALESCE(SUM(ca.offer_amount), 0) FROM call_appointments ca INNER JOIN workshop_lead_classification wlc ON wlc.lead_id = ca.lead_id WHERE wlc.first_workshop_id = w.id AND wlc.product_date IS NOT NULL AND wlc.payment_context_workshop_id IS NOT NULL AND wlc.payment_context_workshop_id != w.id AND ca.status IN ('converted_beginner', 'converted_intermediate', 'converted_advance', 'converted', 'booking_amount')) as rejoin_offer_amount,
    (SELECT COALESCE(SUM(ca.cash_received), 0) FROM call_appointments ca INNER JOIN workshop_lead_classification wlc ON wlc.lead_id = ca.lead_id WHERE wlc.first_workshop_id = w.id AND wlc.product_date IS NOT NULL AND wlc.payment_context_workshop_id IS NOT NULL AND wlc.payment_context_workshop_id != w.id AND ca.status IN ('converted_beginner', 'converted_intermediate', 'converted_advance', 'converted', 'booking_amount')) as rejoin_cash_received,
    (SELECT COUNT(DISTINCT wlc.lead_id) FROM workshop_lead_classification wlc WHERE wlc.first_workshop_id != w.id AND wlc.product_date IS NOT NULL AND wlc.payment_context_workshop_id = w.id) as cross_workshop_count
  FROM workshops w;
$function$;
