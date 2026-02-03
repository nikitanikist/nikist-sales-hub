-- Drop existing function first (return type is changing)
DROP FUNCTION IF EXISTS public.increment_link_click(text);

-- Recreate with new return type including whatsapp_group_id
CREATE OR REPLACE FUNCTION public.increment_link_click(link_slug text)
RETURNS TABLE(destination_url text, invite_link text, whatsapp_group_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  link_record RECORD;
BEGIN
  -- Get and update the link in one atomic operation
  UPDATE public.dynamic_links
  SET click_count = click_count + 1, updated_at = now()
  WHERE slug = link_slug AND is_active = true
  RETURNING 
    dynamic_links.destination_url,
    dynamic_links.whatsapp_group_id
  INTO link_record;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- If it's a WhatsApp group link, get the invite link
  IF link_record.whatsapp_group_id IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      NULL::text as destination_url,
      wg.invite_link,
      link_record.whatsapp_group_id
    FROM public.whatsapp_groups wg
    WHERE wg.id = link_record.whatsapp_group_id;
  ELSE
    RETURN QUERY
    SELECT 
      link_record.destination_url,
      NULL::text as invite_link,
      NULL::uuid as whatsapp_group_id;
  END IF;
END;
$function$