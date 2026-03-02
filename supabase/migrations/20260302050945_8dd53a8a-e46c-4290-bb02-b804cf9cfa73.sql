
-- Table: calling_agent_campaigns
CREATE TABLE public.calling_agent_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  created_by uuid REFERENCES public.profiles(id),
  name text NOT NULL,
  bolna_agent_id text NOT NULL,
  bolna_agent_name text,
  bolna_batch_id text,
  status text NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  total_contacts integer NOT NULL DEFAULT 0,
  calls_completed integer NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: calling_agent_calls
CREATE TABLE public.calling_agent_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.calling_agent_campaigns(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  contact_name text,
  contact_phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  outcome text,
  bolna_call_id text,
  call_duration_seconds integer DEFAULT 0,
  total_cost numeric DEFAULT 0,
  transcript text,
  summary text,
  recording_url text,
  extracted_data jsonb,
  context_details jsonb,
  call_started_at timestamptz,
  call_ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_calling_agent_campaigns_org ON public.calling_agent_campaigns(organization_id);
CREATE INDEX idx_calling_agent_calls_campaign ON public.calling_agent_calls(campaign_id);
CREATE INDEX idx_calling_agent_calls_org ON public.calling_agent_calls(organization_id);
CREATE INDEX idx_calling_agent_calls_bolna ON public.calling_agent_calls(bolna_call_id);

-- Enable RLS
ALTER TABLE public.calling_agent_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calling_agent_calls ENABLE ROW LEVEL SECURITY;

-- RLS policies for calling_agent_campaigns
CREATE POLICY "Users can view their org campaigns"
  ON public.calling_agent_campaigns FOR SELECT TO authenticated
  USING (public.user_belongs_to_org(auth.uid(), organization_id) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users can insert their org campaigns"
  ON public.calling_agent_campaigns FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can update their org campaigns"
  ON public.calling_agent_campaigns FOR UPDATE TO authenticated
  USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can delete their org campaigns"
  ON public.calling_agent_campaigns FOR DELETE TO authenticated
  USING (public.user_belongs_to_org(auth.uid(), organization_id));

-- RLS policies for calling_agent_calls
CREATE POLICY "Users can view their org calls"
  ON public.calling_agent_calls FOR SELECT TO authenticated
  USING (public.user_belongs_to_org(auth.uid(), organization_id) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users can insert their org calls"
  ON public.calling_agent_calls FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can update their org calls"
  ON public.calling_agent_calls FOR UPDATE TO authenticated
  USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can delete their org calls"
  ON public.calling_agent_calls FOR DELETE TO authenticated
  USING (public.user_belongs_to_org(auth.uid(), organization_id));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.calling_agent_campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calling_agent_calls;

-- Updated_at triggers
CREATE TRIGGER update_calling_agent_campaigns_updated_at
  BEFORE UPDATE ON public.calling_agent_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_calling_agent_calls_updated_at
  BEFORE UPDATE ON public.calling_agent_calls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atomic transition function for calling agent calls
CREATE OR REPLACE FUNCTION public.transition_agent_call_to_terminal(
  p_call_id uuid,
  p_status text,
  p_outcome text DEFAULT NULL,
  p_bolna_call_id text DEFAULT NULL,
  p_duration integer DEFAULT 0,
  p_cost numeric DEFAULT 0,
  p_transcript text DEFAULT NULL,
  p_summary text DEFAULT NULL,
  p_recording_url text DEFAULT NULL,
  p_extracted_data jsonb DEFAULT NULL
)
RETURNS TABLE(was_first_transition boolean, campaign_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_was_first boolean := false;
  v_campaign_id uuid;
BEGIN
  UPDATE calling_agent_calls
  SET
    status = p_status,
    outcome = COALESCE(p_outcome, outcome),
    bolna_call_id = COALESCE(p_bolna_call_id, bolna_call_id),
    call_duration_seconds = GREATEST(FLOOR(p_duration)::integer, COALESCE(call_duration_seconds, 0)),
    total_cost = GREATEST(p_cost, COALESCE(total_cost, 0)),
    transcript = COALESCE(p_transcript, transcript),
    summary = COALESCE(p_summary, summary),
    recording_url = COALESCE(p_recording_url, recording_url),
    extracted_data = COALESCE(p_extracted_data, extracted_data),
    call_ended_at = COALESCE(call_ended_at, now()),
    updated_at = now()
  WHERE id = p_call_id
    AND status NOT IN ('completed', 'no-answer', 'busy', 'failed', 'cancelled')
  RETURNING calling_agent_calls.campaign_id INTO v_campaign_id;

  IF FOUND THEN
    v_was_first := true;
    -- Update campaign counters
    UPDATE calling_agent_campaigns
    SET calls_completed = calls_completed + 1,
        total_cost = (SELECT COALESCE(SUM(cac.total_cost), 0) FROM calling_agent_calls cac WHERE cac.campaign_id = v_campaign_id),
        updated_at = now()
    WHERE id = v_campaign_id;

    -- Check if all calls are done
    UPDATE calling_agent_campaigns
    SET status = 'completed', completed_at = now()
    WHERE id = v_campaign_id
      AND calls_completed >= total_contacts
      AND status = 'running';
  ELSE
    SELECT cac.campaign_id INTO v_campaign_id FROM calling_agent_calls cac WHERE cac.id = p_call_id;
  END IF;

  was_first_transition := v_was_first;
  campaign_id := v_campaign_id;
  RETURN NEXT;
END;
$$;
