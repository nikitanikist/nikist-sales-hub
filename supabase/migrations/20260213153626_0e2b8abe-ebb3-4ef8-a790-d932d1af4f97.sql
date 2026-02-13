CREATE OR REPLACE FUNCTION public.increment_delivered_count(p_group_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE notification_campaign_groups
  SET delivered_count = LEAST(COALESCE(delivered_count, 0) + 1, COALESCE(member_count, 999999))
  WHERE id = p_group_id
  RETURNING delivered_count;
$$;