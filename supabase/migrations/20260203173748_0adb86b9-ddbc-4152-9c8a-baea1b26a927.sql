-- Create workshop_group_members table for tracking join/leave events
CREATE TABLE public.workshop_group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.whatsapp_groups(id) ON DELETE SET NULL,
  group_jid TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  full_phone TEXT NOT NULL,
  participant_jid TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'left')),
  is_admin BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique constraint: one record per group + phone combination
  CONSTRAINT workshop_group_members_group_phone_unique UNIQUE (group_jid, phone_number)
);

-- Create index for faster lookups
CREATE INDEX idx_workshop_group_members_org ON public.workshop_group_members(organization_id);
CREATE INDEX idx_workshop_group_members_group_jid ON public.workshop_group_members(group_jid);
CREATE INDEX idx_workshop_group_members_phone ON public.workshop_group_members(phone_number);
CREATE INDEX idx_workshop_group_members_status ON public.workshop_group_members(status);

-- Enable Row Level Security
ALTER TABLE public.workshop_group_members ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Organization members can view their own org's data
CREATE POLICY "Organization members can view group members"
ON public.workshop_group_members
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

-- RLS Policy: Organization members can insert
CREATE POLICY "Organization members can insert group members"
ON public.workshop_group_members
FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

-- RLS Policy: Organization members can update
CREATE POLICY "Organization members can update group members"
ON public.workshop_group_members
FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_workshop_group_members_updated_at
BEFORE UPDATE ON public.workshop_group_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for instant UI updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.workshop_group_members;