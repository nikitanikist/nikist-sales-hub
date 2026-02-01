-- Add community_session_id column to organizations table
ALTER TABLE public.organizations 
ADD COLUMN community_session_id uuid REFERENCES public.whatsapp_sessions(id) ON DELETE SET NULL;

-- Add community_group_id column to workshops table
ALTER TABLE public.workshops 
ADD COLUMN community_group_id uuid REFERENCES public.whatsapp_groups(id) ON DELETE SET NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.organizations.community_session_id IS 'WhatsApp session used for auto-creating communities when workshops are created';
COMMENT ON COLUMN public.workshops.community_group_id IS 'Reference to the auto-created WhatsApp community for this workshop';