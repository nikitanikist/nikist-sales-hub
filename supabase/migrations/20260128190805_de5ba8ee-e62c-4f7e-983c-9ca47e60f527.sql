-- Update get_closer_call_counts to accept organization_id
DROP FUNCTION IF EXISTS public.get_closer_call_counts(date);
CREATE OR REPLACE FUNCTION public.get_closer_call_counts(target_date date, p_organization_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid, full_name text, call_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.full_name,
    COUNT(ca.id) as call_count
  FROM profiles p
  LEFT JOIN call_appointments ca ON ca.closer_id = p.id 
    AND ca.scheduled_date = target_date
    AND (p_organization_id IS NULL OR ca.organization_id = p_organization_id)
  WHERE EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.user_id = p.id 
    AND om.role = 'sales_rep'
    AND (p_organization_id IS NULL OR om.organization_id = p_organization_id)
  )
  GROUP BY p.id, p.full_name
  ORDER BY call_count DESC;
$$;

-- Update get_closer_call_metrics to accept organization_id
DROP FUNCTION IF EXISTS public.get_closer_call_metrics(date);
CREATE OR REPLACE FUNCTION public.get_closer_call_metrics(target_date date, p_organization_id uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  full_name text,
  total_calls bigint,
  converted_count bigint,
  not_converted_count bigint,
  pending_count bigint,
  rescheduled_count bigint,
  offered_amount numeric,
  cash_collected numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.full_name,
    COUNT(ca.id) as total_calls,
    COUNT(CASE WHEN ca.status IN ('converted', 'converted_beginner', 'converted_intermediate', 'converted_advance') THEN 1 END) as converted_count,
    COUNT(CASE WHEN ca.status = 'not_converted' THEN 1 END) as not_converted_count,
    COUNT(CASE WHEN ca.status IN ('scheduled', 'pending', 'not_decided', 'so_so') THEN 1 END) as pending_count,
    COUNT(CASE WHEN ca.status = 'reschedule' THEN 1 END) as rescheduled_count,
    COALESCE(SUM(ca.offer_amount), 0) as offered_amount,
    COALESCE(SUM(ca.cash_received), 0) as cash_collected
  FROM profiles p
  LEFT JOIN call_appointments ca ON ca.closer_id = p.id 
    AND ca.scheduled_date = target_date
    AND (p_organization_id IS NULL OR ca.organization_id = p_organization_id)
  WHERE EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.user_id = p.id 
    AND om.role = 'sales_rep'
    AND (p_organization_id IS NULL OR om.organization_id = p_organization_id)
  )
  GROUP BY p.id, p.full_name
  ORDER BY total_calls DESC;
$$;

-- Update get_workshop_metrics to accept organization_id
DROP FUNCTION IF EXISTS public.get_workshop_metrics();
CREATE OR REPLACE FUNCTION public.get_workshop_metrics(p_organization_id uuid DEFAULT NULL)
RETURNS TABLE(
  workshop_id uuid,
  registration_count bigint,
  total_calls_booked bigint,
  converted_calls bigint,
  not_converted_calls bigint,
  remaining_calls bigint,
  refunded_calls bigint,
  booking_amount_calls bigint,
  rescheduled_done bigint,
  rescheduled_remaining bigint,
  sales_count bigint,
  total_offer_amount numeric,
  total_cash_received numeric,
  fresh_sales_count bigint,
  fresh_converted bigint,
  fresh_not_converted bigint,
  fresh_remaining bigint,
  fresh_rescheduled_done bigint,
  fresh_rescheduled_remaining bigint,
  fresh_offer_amount numeric,
  fresh_cash_received numeric,
  fresh_booking_amount numeric,
  rejoin_sales_count bigint,
  rejoin_converted bigint,
  rejoin_not_converted bigint,
  rejoin_remaining bigint,
  rejoin_rescheduled_done bigint,
  rejoin_rescheduled_remaining bigint,
  rejoin_offer_amount numeric,
  rejoin_cash_received numeric,
  rejoin_booking_amount numeric,
  cross_workshop_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    w.id as workshop_id,
    (SELECT COUNT(*) FROM lead_assignments la WHERE la.workshop_id = w.id AND (p_organization_id IS NULL OR la.organization_id = p_organization_id)) as registration_count,
    COUNT(DISTINCT ca.id) as total_calls_booked,
    COUNT(DISTINCT CASE WHEN ca.status IN ('converted', 'converted_beginner', 'converted_intermediate', 'converted_advance') THEN ca.id END) as converted_calls,
    COUNT(DISTINCT CASE WHEN ca.status = 'not_converted' THEN ca.id END) as not_converted_calls,
    COUNT(DISTINCT CASE WHEN ca.status IN ('scheduled', 'pending', 'not_decided', 'so_so') THEN ca.id END) as remaining_calls,
    COUNT(DISTINCT CASE WHEN ca.status = 'refunded' THEN ca.id END) as refunded_calls,
    COUNT(DISTINCT CASE WHEN ca.status = 'booking_amount' THEN ca.id END) as booking_amount_calls,
    COUNT(DISTINCT CASE WHEN ca.status = 'reschedule' AND ca.scheduled_date < CURRENT_DATE THEN ca.id END) as rescheduled_done,
    COUNT(DISTINCT CASE WHEN ca.status = 'reschedule' AND ca.scheduled_date >= CURRENT_DATE THEN ca.id END) as rescheduled_remaining,
    COUNT(DISTINCT CASE WHEN ca.status IN ('converted', 'converted_beginner', 'converted_intermediate', 'converted_advance', 'booking_amount') THEN ca.id END) as sales_count,
    COALESCE(SUM(CASE WHEN ca.status IN ('converted', 'converted_beginner', 'converted_intermediate', 'converted_advance', 'booking_amount') THEN ca.offer_amount ELSE 0 END), 0) as total_offer_amount,
    COALESCE(SUM(CASE WHEN ca.status IN ('converted', 'converted_beginner', 'converted_intermediate', 'converted_advance', 'booking_amount') THEN ca.cash_received ELSE 0 END), 0) as total_cash_received,
    0::bigint as fresh_sales_count,
    0::bigint as fresh_converted,
    0::bigint as fresh_not_converted,
    0::bigint as fresh_remaining,
    0::bigint as fresh_rescheduled_done,
    0::bigint as fresh_rescheduled_remaining,
    0::numeric as fresh_offer_amount,
    0::numeric as fresh_cash_received,
    0::numeric as fresh_booking_amount,
    0::bigint as rejoin_sales_count,
    0::bigint as rejoin_converted,
    0::bigint as rejoin_not_converted,
    0::bigint as rejoin_remaining,
    0::bigint as rejoin_rescheduled_done,
    0::bigint as rejoin_rescheduled_remaining,
    0::numeric as rejoin_offer_amount,
    0::numeric as rejoin_cash_received,
    0::numeric as rejoin_booking_amount,
    0::bigint as cross_workshop_count
  FROM workshops w
  LEFT JOIN leads l ON l.workshop_name = w.title AND (p_organization_id IS NULL OR l.organization_id = p_organization_id)
  LEFT JOIN call_appointments ca ON ca.lead_id = l.id AND (p_organization_id IS NULL OR ca.organization_id = p_organization_id)
  WHERE (p_organization_id IS NULL OR w.organization_id = p_organization_id)
  GROUP BY w.id;
$$;

-- Update get_workshop_calls_by_category to accept organization_id
DROP FUNCTION IF EXISTS public.get_workshop_calls_by_category(text, text);
CREATE OR REPLACE FUNCTION public.get_workshop_calls_by_category(p_category text, p_workshop_title text, p_organization_id uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  lead_id uuid,
  contact_name text,
  email text,
  phone text,
  scheduled_date date,
  scheduled_time time,
  status text,
  closer_name text,
  offer_amount numeric,
  cash_received numeric,
  was_rescheduled boolean,
  original_workshop_title text,
  payment_workshop_title text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ca.id,
    ca.lead_id,
    l.contact_name,
    l.email,
    l.phone,
    ca.scheduled_date,
    ca.scheduled_time,
    ca.status::text,
    p.full_name as closer_name,
    ca.offer_amount,
    ca.cash_received,
    ca.was_rescheduled,
    l.workshop_name as original_workshop_title,
    l.workshop_name as payment_workshop_title
  FROM call_appointments ca
  JOIN leads l ON l.id = ca.lead_id
  LEFT JOIN profiles p ON p.id = ca.closer_id
  WHERE l.workshop_name = p_workshop_title
    AND (p_organization_id IS NULL OR ca.organization_id = p_organization_id)
    AND (
      (p_category = 'converted' AND ca.status IN ('converted', 'converted_beginner', 'converted_intermediate', 'converted_advance'))
      OR (p_category = 'not_converted' AND ca.status = 'not_converted')
      OR (p_category = 'remaining' AND ca.status IN ('scheduled', 'pending', 'not_decided', 'so_so'))
      OR (p_category = 'refunded' AND ca.status = 'refunded')
      OR (p_category = 'booking_amount' AND ca.status = 'booking_amount')
      OR (p_category = 'rescheduled' AND ca.status = 'reschedule')
    )
  ORDER BY ca.scheduled_date DESC, ca.scheduled_time DESC;
$$;

-- Update get_workshop_sales_leads to accept organization_id
DROP FUNCTION IF EXISTS public.get_workshop_sales_leads(text);
CREATE OR REPLACE FUNCTION public.get_workshop_sales_leads(p_workshop_title text, p_organization_id uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  lead_id uuid,
  assignment_id uuid,
  contact_name text,
  email text,
  phone text,
  status text,
  scheduled_date date,
  scheduled_time time,
  closer_name text,
  has_call_appointment boolean,
  call_appointment_id uuid,
  is_assignment_refunded boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    l.id,
    l.id as lead_id,
    la.id as assignment_id,
    l.contact_name,
    l.email,
    l.phone,
    COALESCE(ca.status::text, 'no_call') as status,
    ca.scheduled_date,
    ca.scheduled_time,
    p.full_name as closer_name,
    (ca.id IS NOT NULL) as has_call_appointment,
    ca.id as call_appointment_id,
    COALESCE(la.is_refunded, false) as is_assignment_refunded
  FROM leads l
  JOIN lead_assignments la ON la.lead_id = l.id
  LEFT JOIN call_appointments ca ON ca.lead_id = l.id AND (p_organization_id IS NULL OR ca.organization_id = p_organization_id)
  LEFT JOIN profiles p ON p.id = ca.closer_id
  WHERE l.workshop_name = p_workshop_title
    AND (p_organization_id IS NULL OR l.organization_id = p_organization_id)
  ORDER BY l.created_at DESC;
$$;

-- Update search_leads to accept organization_id
DROP FUNCTION IF EXISTS public.search_leads(text);
CREATE OR REPLACE FUNCTION public.search_leads(search_query text, p_organization_id uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  contact_name text,
  email text,
  phone text,
  company_name text,
  country text,
  status text,
  notes text,
  source text,
  created_at timestamptz,
  updated_at timestamptz,
  assigned_to uuid,
  assigned_to_name text,
  assignment_id uuid,
  workshop_id uuid,
  workshop_name text,
  workshop_title text,
  funnel_id uuid,
  funnel_name text,
  product_id uuid,
  product_name text,
  product_price numeric,
  is_connected boolean,
  is_refunded boolean,
  refund_reason text,
  refunded_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    l.id,
    l.contact_name,
    l.email,
    l.phone,
    l.company_name,
    l.country,
    l.status::text,
    l.notes,
    l.source,
    l.created_at,
    l.updated_at,
    l.assigned_to,
    p.full_name as assigned_to_name,
    la.id as assignment_id,
    la.workshop_id,
    l.workshop_name,
    w.title as workshop_title,
    la.funnel_id,
    f.funnel_name,
    la.product_id,
    pr.product_name,
    pr.price as product_price,
    COALESCE(la.is_connected, false) as is_connected,
    COALESCE(la.is_refunded, false) as is_refunded,
    la.refund_reason,
    la.refunded_at
  FROM leads l
  LEFT JOIN lead_assignments la ON la.lead_id = l.id
  LEFT JOIN profiles p ON p.id = l.assigned_to
  LEFT JOIN workshops w ON w.id = la.workshop_id
  LEFT JOIN funnels f ON f.id = la.funnel_id
  LEFT JOIN products pr ON pr.id = la.product_id
  WHERE (p_organization_id IS NULL OR l.organization_id = p_organization_id)
    AND (
      l.contact_name ILIKE '%' || search_query || '%'
      OR l.email ILIKE '%' || search_query || '%'
      OR l.phone ILIKE '%' || search_query || '%'
      OR l.company_name ILIKE '%' || search_query || '%'
    )
  ORDER BY l.created_at DESC
  LIMIT 100;
$$;