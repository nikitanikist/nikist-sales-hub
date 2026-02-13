
-- Table to track read receipts for campaign messages
CREATE TABLE public.notification_campaign_reads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_group_id uuid NOT NULL REFERENCES public.notification_campaign_groups(id) ON DELETE CASCADE,
  reader_phone text NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_group_id, reader_phone)
);

-- Table to track reactions for campaign messages
CREATE TABLE public.notification_campaign_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_group_id uuid NOT NULL REFERENCES public.notification_campaign_groups(id) ON DELETE CASCADE,
  reactor_phone text NOT NULL,
  emoji text NOT NULL,
  reacted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_group_id, reactor_phone, emoji)
);

-- Indexes for fast lookups
CREATE INDEX idx_campaign_reads_group ON public.notification_campaign_reads(campaign_group_id);
CREATE INDEX idx_campaign_reactions_group ON public.notification_campaign_reactions(campaign_group_id);

-- Enable RLS
ALTER TABLE public.notification_campaign_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_campaign_reactions ENABLE ROW LEVEL SECURITY;

-- RLS: org members can SELECT via join to campaign groups -> campaigns
CREATE POLICY "Org members can view reads"
  ON public.notification_campaign_reads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM notification_campaign_groups ncg
      JOIN notification_campaigns nc ON nc.id = ncg.campaign_id
      JOIN organization_members om ON om.organization_id = nc.organization_id
      WHERE ncg.id = notification_campaign_reads.campaign_group_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can view reactions"
  ON public.notification_campaign_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM notification_campaign_groups ncg
      JOIN notification_campaigns nc ON nc.id = ncg.campaign_id
      JOIN organization_members om ON om.organization_id = nc.organization_id
      WHERE ncg.id = notification_campaign_reactions.campaign_group_id
        AND om.user_id = auth.uid()
    )
  );

-- Service role inserts from webhooks (no user INSERT policy needed)

-- Add read_count and reaction_count columns to campaign_groups for fast aggregation
ALTER TABLE public.notification_campaign_groups
  ADD COLUMN read_count integer NOT NULL DEFAULT 0,
  ADD COLUMN reaction_count integer NOT NULL DEFAULT 0;
