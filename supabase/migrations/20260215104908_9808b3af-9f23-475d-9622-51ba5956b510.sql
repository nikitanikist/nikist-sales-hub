
CREATE OR REPLACE FUNCTION public.increment_delivered_count(p_group_id uuid)
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE notification_campaign_groups
  SET delivered_count = CASE
    WHEN COALESCE(member_count, 0) > 0
      THEN LEAST(COALESCE(delivered_count, 0) + 1, member_count)
    ELSE COALESCE(delivered_count, 0) + 1
  END
  WHERE id = p_group_id
  RETURNING delivered_count;
$$;

CREATE OR REPLACE FUNCTION public.increment_read_count(p_group_id uuid)
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE notification_campaign_groups
  SET read_count = CASE
    WHEN COALESCE(member_count, 0) > 0
      THEN LEAST(COALESCE(read_count, 0) + 1, member_count)
    ELSE COALESCE(read_count, 0) + 1
  END
  WHERE id = p_group_id
  RETURNING read_count;
$$;
