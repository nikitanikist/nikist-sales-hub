
-- Add processing_started_at to notification_campaign_groups for stale claim detection
ALTER TABLE public.notification_campaign_groups
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;

-- Add processing_by to notification_campaigns for campaign-level locking
ALTER TABLE public.notification_campaigns
  ADD COLUMN IF NOT EXISTS processing_by text,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;
