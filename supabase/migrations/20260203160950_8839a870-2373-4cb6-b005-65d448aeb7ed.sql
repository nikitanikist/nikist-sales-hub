-- Drop the old function first (return type is changing)
DROP FUNCTION IF EXISTS public.increment_link_click(text);

-- Recreate with simplified signature - only returns destination_url
-- No longer needs to join whatsapp_groups since URLs are stored directly
CREATE FUNCTION public.increment_link_click(link_slug text)
RETURNS TABLE(destination_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.dynamic_links
  SET click_count = click_count + 1, updated_at = now()
  WHERE slug = link_slug AND is_active = true
  RETURNING dynamic_links.destination_url;
END;
$$;