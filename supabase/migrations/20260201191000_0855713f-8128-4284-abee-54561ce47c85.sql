-- Create dynamic_links table for URL redirection system
CREATE TABLE public.dynamic_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  slug text NOT NULL,
  destination_url text,
  whatsapp_group_id uuid REFERENCES public.whatsapp_groups(id) ON DELETE SET NULL,
  click_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Ensure slug is unique per organization
  CONSTRAINT dynamic_links_org_slug_unique UNIQUE (organization_id, slug),
  
  -- Ensure either destination_url or whatsapp_group_id is set (not both, not neither)
  CONSTRAINT dynamic_links_destination_check CHECK (
    (destination_url IS NOT NULL AND whatsapp_group_id IS NULL) OR
    (destination_url IS NULL AND whatsapp_group_id IS NOT NULL)
  )
);

-- Create index for fast slug lookups
CREATE INDEX idx_dynamic_links_slug ON public.dynamic_links(slug);
CREATE INDEX idx_dynamic_links_org ON public.dynamic_links(organization_id);

-- Enable RLS
ALTER TABLE public.dynamic_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- SELECT: Users in organization can view
CREATE POLICY "Users can view links in their organization"
ON public.dynamic_links
FOR SELECT
USING (
  (organization_id = ANY (get_user_organization_ids()))
  OR is_super_admin(auth.uid())
);

-- INSERT: Admins and managers can create
CREATE POLICY "Admins and managers can create links"
ON public.dynamic_links
FOR INSERT
WITH CHECK (
  ((organization_id = ANY (get_user_organization_ids()))
  AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

-- UPDATE: Admins and managers can update
CREATE POLICY "Admins and managers can update links"
ON public.dynamic_links
FOR UPDATE
USING (
  ((organization_id = ANY (get_user_organization_ids()))
  AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

-- DELETE: Admins only
CREATE POLICY "Admins can delete links"
ON public.dynamic_links
FOR DELETE
USING (
  ((organization_id = ANY (get_user_organization_ids()))
  AND has_org_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- Public read policy for redirect handler (needs to read by slug without auth)
CREATE POLICY "Public can read active links by slug"
ON public.dynamic_links
FOR SELECT
USING (is_active = true);

-- Function to increment click count atomically (bypasses RLS for public access)
CREATE OR REPLACE FUNCTION public.increment_link_click(link_slug text)
RETURNS TABLE (
  destination_url text,
  invite_link text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      wg.invite_link
    FROM public.whatsapp_groups wg
    WHERE wg.id = link_record.whatsapp_group_id;
  ELSE
    RETURN QUERY
    SELECT 
      link_record.destination_url,
      NULL::text as invite_link;
  END IF;
END;
$$;