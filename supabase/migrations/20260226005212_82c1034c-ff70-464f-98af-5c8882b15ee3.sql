
-- Table: voice_campaigns
CREATE TABLE public.voice_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  agent_type TEXT NOT NULL DEFAULT 'workshop_reminder',
  bolna_agent_id TEXT,
  bolna_batch_id TEXT,
  workshop_time TEXT,
  workshop_name TEXT,
  workshop_id UUID REFERENCES public.workshops(id),
  whatsapp_template_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  total_contacts INT DEFAULT 0,
  calls_completed INT DEFAULT 0,
  calls_confirmed INT DEFAULT 0,
  calls_rescheduled INT DEFAULT 0,
  calls_not_interested INT DEFAULT 0,
  calls_no_answer INT DEFAULT 0,
  calls_failed INT DEFAULT 0,
  total_cost DECIMAL(10,2) DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_campaigns_org ON public.voice_campaigns(organization_id, created_at DESC);
CREATE INDEX idx_voice_campaigns_status ON public.voice_campaigns(organization_id, status);

ALTER TABLE public.voice_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view campaigns in their org"
  ON public.voice_campaigns FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create campaigns in their org"
  ON public.voice_campaigns FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update campaigns in their org"
  ON public.voice_campaigns FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

-- Table: voice_campaign_calls
CREATE TABLE public.voice_campaign_calls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.voice_campaigns(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  lead_id UUID REFERENCES public.leads(id),
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  outcome TEXT,
  reschedule_day TEXT,
  in_whatsapp_group BOOLEAN,
  whatsapp_link_sent BOOLEAN DEFAULT FALSE,
  remarks TEXT,
  bolna_call_id TEXT,
  call_duration_seconds INT,
  total_cost DECIMAL(10,2),
  transcript TEXT,
  recording_url TEXT,
  extracted_data JSONB,
  call_started_at TIMESTAMPTZ,
  call_ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vcc_campaign_status ON public.voice_campaign_calls(campaign_id, status);
CREATE INDEX idx_vcc_campaign_outcome ON public.voice_campaign_calls(campaign_id, outcome);
CREATE INDEX idx_vcc_bolna_id ON public.voice_campaign_calls(bolna_call_id);

ALTER TABLE public.voice_campaign_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view campaign calls in their org"
  ON public.voice_campaign_calls FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert campaign calls in their org"
  ON public.voice_campaign_calls FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update campaign calls in their org"
  ON public.voice_campaign_calls FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_campaign_calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_campaigns;

-- Increment function for atomic counter updates from edge functions
CREATE OR REPLACE FUNCTION public.increment_campaign_counter(
  p_campaign_id UUID,
  p_field TEXT
) RETURNS VOID AS $$
BEGIN
  EXECUTE format(
    'UPDATE public.voice_campaigns SET %I = %I + 1, calls_completed = calls_completed + 1, updated_at = NOW() WHERE id = $1',
    p_field, p_field
  ) USING p_campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';
