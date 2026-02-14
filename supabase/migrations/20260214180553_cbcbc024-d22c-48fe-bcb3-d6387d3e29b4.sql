
-- Composite index for paginated lead queries (DESC for default sort)
CREATE INDEX IF NOT EXISTS idx_leads_org_created_desc 
  ON leads (organization_id, created_at DESC);

-- Index for email-level cross-filtering
CREATE INDEX IF NOT EXISTS idx_lead_assignments_lead_id_product
  ON lead_assignments (lead_id, product_id) WHERE product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_assignments_lead_id_workshop
  ON lead_assignments (lead_id, workshop_id) WHERE workshop_id IS NOT NULL;

-- ============================================================
-- RPC: count_paginated_leads
-- Returns total count of DISPLAY ROWS (not unique leads) matching filters
-- ============================================================
CREATE OR REPLACE FUNCTION public.count_paginated_leads(
  p_organization_id uuid,
  p_search text DEFAULT '',
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_status text DEFAULT 'all',
  p_country text DEFAULT 'all',
  p_product_ids uuid[] DEFAULT '{}'::uuid[],
  p_workshop_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH qualified_leads AS (
    SELECT l.id, l.email
    FROM leads l
    WHERE l.organization_id = p_organization_id
      -- Search filter
      AND (p_search = '' OR (
        l.contact_name ILIKE '%' || p_search || '%'
        OR l.email ILIKE '%' || p_search || '%'
        OR l.phone ILIKE '%' || p_search || '%'
      ))
      -- Date filters
      AND (p_date_from IS NULL OR l.created_at >= p_date_from)
      AND (p_date_to IS NULL OR l.created_at < p_date_to + interval '1 day')
      -- Status filter
      AND (p_status = 'all' 
        OR (p_status = 'active' AND l.status != 'lost')
        OR (p_status = 'inactive' AND l.status = 'lost')
        OR (p_status = 'revoked' AND l.status = 'lost')
      )
      -- Country filter
      AND (p_country = 'all' OR l.country = p_country)
      -- Product filter: lead's email must have at least one assignment matching product
      AND (array_length(p_product_ids, 1) IS NULL OR EXISTS (
        SELECT 1 FROM lead_assignments la2
        JOIN leads l2 ON l2.id = la2.lead_id AND l2.email = l.email
        WHERE la2.organization_id = p_organization_id
          AND la2.product_id = ANY(p_product_ids)
      ))
      -- Workshop filter: lead's email must have at least one assignment matching workshop
      AND (array_length(p_workshop_ids, 1) IS NULL OR EXISTS (
        SELECT 1 FROM lead_assignments la2
        JOIN leads l2 ON l2.id = la2.lead_id AND l2.email = l.email
        WHERE la2.organization_id = p_organization_id
          AND la2.workshop_id = ANY(p_workshop_ids)
      ))
  ),
  -- Count display rows: when product+workshop filters active, count matching assignments
  -- When no product/workshop filter, count leads (with or without assignments)
  display_rows AS (
    SELECT 
      CASE 
        -- Both filters: show matching assignments per email (consolidated view)
        WHEN array_length(p_product_ids, 1) IS NOT NULL AND array_length(p_workshop_ids, 1) IS NOT NULL THEN
          (SELECT COUNT(*) FROM (
            SELECT la.id FROM qualified_leads ql
            JOIN lead_assignments la ON la.lead_id = ql.id
            WHERE la.organization_id = p_organization_id
              AND (
                (la.product_id = ANY(p_product_ids))
                OR (la.workshop_id = ANY(p_workshop_ids))
              )
          ) sub)
        -- Single filter: count assignments
        WHEN array_length(p_product_ids, 1) IS NOT NULL OR array_length(p_workshop_ids, 1) IS NOT NULL THEN
          (SELECT COUNT(*) FROM qualified_leads ql
           JOIN lead_assignments la ON la.lead_id = ql.id
           WHERE la.organization_id = p_organization_id
             AND (
               (array_length(p_product_ids, 1) IS NOT NULL AND la.product_id = ANY(p_product_ids))
               OR (array_length(p_workshop_ids, 1) IS NOT NULL AND la.workshop_id = ANY(p_workshop_ids))
             ))
        -- No product/workshop filter: count unique leads (each lead = 1 row even with multiple assignments)
        ELSE
          (SELECT COUNT(DISTINCT sub.display_key) FROM (
            -- Leads with assignments: one row per assignment
            SELECT la.id::text as display_key FROM qualified_leads ql
            JOIN lead_assignments la ON la.lead_id = ql.id AND la.organization_id = p_organization_id
            UNION ALL
            -- Leads without any assignments: one row per lead
            SELECT ql.id::text as display_key FROM qualified_leads ql
            WHERE NOT EXISTS (
              SELECT 1 FROM lead_assignments la WHERE la.lead_id = ql.id AND la.organization_id = p_organization_id
            )
          ) sub)
      END as cnt
  )
  SELECT cnt FROM display_rows;
$function$;

-- ============================================================
-- RPC: get_paginated_leads
-- Returns paginated lead+assignment rows with all joined data
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_paginated_leads(
  p_organization_id uuid,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 10,
  p_search text DEFAULT '',
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_status text DEFAULT 'all',
  p_country text DEFAULT 'all',
  p_product_ids uuid[] DEFAULT '{}'::uuid[],
  p_workshop_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS TABLE(
  lead_id uuid,
  contact_name text,
  company_name text,
  email text,
  phone text,
  country text,
  lead_status text,
  notes text,
  source text,
  lead_created_at timestamptz,
  lead_updated_at timestamptz,
  assigned_to uuid,
  assigned_to_name text,
  previous_assigned_to uuid,
  previous_assigned_to_name text,
  assignment_id uuid,
  workshop_id uuid,
  workshop_title text,
  product_id uuid,
  product_name text,
  product_price numeric,
  funnel_id uuid,
  funnel_name text,
  is_connected boolean,
  is_refunded boolean,
  refund_reason text,
  refunded_at timestamptz,
  converted_from_workshop_id uuid,
  converted_from_workshop_title text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH qualified_leads AS (
    SELECT l.id, l.email
    FROM leads l
    WHERE l.organization_id = p_organization_id
      AND (p_search = '' OR (
        l.contact_name ILIKE '%' || p_search || '%'
        OR l.email ILIKE '%' || p_search || '%'
        OR l.phone ILIKE '%' || p_search || '%'
      ))
      AND (p_date_from IS NULL OR l.created_at >= p_date_from)
      AND (p_date_to IS NULL OR l.created_at < p_date_to + interval '1 day')
      AND (p_status = 'all' 
        OR (p_status = 'active' AND l.status != 'lost')
        OR (p_status = 'inactive' AND l.status = 'lost')
        OR (p_status = 'revoked' AND l.status = 'lost')
      )
      AND (p_country = 'all' OR l.country = p_country)
      AND (array_length(p_product_ids, 1) IS NULL OR EXISTS (
        SELECT 1 FROM lead_assignments la2
        JOIN leads l2 ON l2.id = la2.lead_id AND l2.email = l.email
        WHERE la2.organization_id = p_organization_id
          AND la2.product_id = ANY(p_product_ids)
      ))
      AND (array_length(p_workshop_ids, 1) IS NULL OR EXISTS (
        SELECT 1 FROM lead_assignments la2
        JOIN leads l2 ON l2.id = la2.lead_id AND l2.email = l.email
        WHERE la2.organization_id = p_organization_id
          AND la2.workshop_id = ANY(p_workshop_ids)
      ))
  ),
  -- Build display rows with a sort key for consistent pagination
  display_rows AS (
    -- Both product+workshop filters: show only matching assignments (consolidated view)
    SELECT 
      la.id as sort_secondary,
      l.created_at as sort_primary,
      l.id as l_id,
      la.id as la_id
    FROM qualified_leads ql
    JOIN leads l ON l.id = ql.id
    JOIN lead_assignments la ON la.lead_id = ql.id AND la.organization_id = p_organization_id
    WHERE array_length(p_product_ids, 1) IS NOT NULL 
      AND array_length(p_workshop_ids, 1) IS NOT NULL
      AND (la.product_id = ANY(p_product_ids) OR la.workshop_id = ANY(p_workshop_ids))
    
    UNION ALL
    
    -- Single product filter: show matching assignments
    SELECT 
      la.id as sort_secondary,
      l.created_at as sort_primary,
      l.id as l_id,
      la.id as la_id
    FROM qualified_leads ql
    JOIN leads l ON l.id = ql.id
    JOIN lead_assignments la ON la.lead_id = ql.id AND la.organization_id = p_organization_id
    WHERE array_length(p_product_ids, 1) IS NOT NULL 
      AND array_length(p_workshop_ids, 1) IS NULL
      AND la.product_id = ANY(p_product_ids)
    
    UNION ALL
    
    -- Single workshop filter: show matching assignments
    SELECT 
      la.id as sort_secondary,
      l.created_at as sort_primary,
      l.id as l_id,
      la.id as la_id
    FROM qualified_leads ql
    JOIN leads l ON l.id = ql.id
    JOIN lead_assignments la ON la.lead_id = ql.id AND la.organization_id = p_organization_id
    WHERE array_length(p_workshop_ids, 1) IS NOT NULL 
      AND array_length(p_product_ids, 1) IS NULL
      AND la.workshop_id = ANY(p_workshop_ids)
    
    UNION ALL
    
    -- No product/workshop filter: all assignments + leads without assignments
    SELECT 
      la.id as sort_secondary,
      l.created_at as sort_primary,
      l.id as l_id,
      la.id as la_id
    FROM qualified_leads ql
    JOIN leads l ON l.id = ql.id
    JOIN lead_assignments la ON la.lead_id = ql.id AND la.organization_id = p_organization_id
    WHERE array_length(p_product_ids, 1) IS NULL AND array_length(p_workshop_ids, 1) IS NULL
    
    UNION ALL
    
    -- Leads without any assignments (only when no product/workshop filter)
    SELECT 
      NULL::uuid as sort_secondary,
      l.created_at as sort_primary,
      l.id as l_id,
      NULL::uuid as la_id
    FROM qualified_leads ql
    JOIN leads l ON l.id = ql.id
    WHERE array_length(p_product_ids, 1) IS NULL AND array_length(p_workshop_ids, 1) IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM lead_assignments la WHERE la.lead_id = ql.id AND la.organization_id = p_organization_id
      )
  ),
  paginated AS (
    SELECT l_id, la_id
    FROM display_rows
    ORDER BY sort_primary DESC, sort_secondary DESC NULLS LAST
    OFFSET p_offset
    LIMIT p_limit
  )
  SELECT 
    l.id as lead_id,
    l.contact_name,
    l.company_name,
    l.email,
    l.phone,
    l.country,
    l.status::text as lead_status,
    l.notes,
    l.source,
    l.created_at as lead_created_at,
    l.updated_at as lead_updated_at,
    l.assigned_to,
    p_assigned.full_name as assigned_to_name,
    l.previous_assigned_to,
    p_prev.full_name as previous_assigned_to_name,
    la.id as assignment_id,
    la.workshop_id,
    w.title as workshop_title,
    la.product_id,
    pr.product_name,
    pr.price as product_price,
    la.funnel_id,
    f.funnel_name,
    COALESCE(la.is_connected, false) as is_connected,
    COALESCE(la.is_refunded, false) as is_refunded,
    la.refund_reason,
    la.refunded_at,
    la.converted_from_workshop_id,
    cw.title as converted_from_workshop_title
  FROM paginated pg
  JOIN leads l ON l.id = pg.l_id
  LEFT JOIN lead_assignments la ON la.id = pg.la_id
  LEFT JOIN profiles p_assigned ON p_assigned.id = l.assigned_to
  LEFT JOIN profiles p_prev ON p_prev.id = l.previous_assigned_to
  LEFT JOIN workshops w ON w.id = la.workshop_id
  LEFT JOIN products pr ON pr.id = la.product_id
  LEFT JOIN funnels f ON f.id = la.funnel_id
  LEFT JOIN workshops cw ON cw.id = la.converted_from_workshop_id
  ORDER BY l.created_at DESC, la.id DESC NULLS LAST;
$function$;

-- Update statistics for query planner
ANALYZE leads;
ANALYZE lead_assignments;
