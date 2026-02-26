CREATE OR REPLACE FUNCTION public.increment_campaign_counter(p_campaign_id uuid, p_field text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  EXECUTE format(
    'UPDATE public.voice_campaigns SET %I = %I + 1, updated_at = NOW() WHERE id = $1',
    p_field, p_field
  ) USING p_campaign_id;
END;
$$;