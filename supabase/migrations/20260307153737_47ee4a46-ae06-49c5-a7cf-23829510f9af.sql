
-- ============================================================
-- IVR Campaign System: Tables, RLS, Indexes, Realtime, RPCs
-- ============================================================

-- 1. ivr_campaigns
CREATE TABLE public.ivr_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft',

    -- Audio configuration
    audio_opening_url TEXT NOT NULL,
    audio_thankyou_url TEXT NOT NULL,
    audio_not_interested_url TEXT NOT NULL,
    audio_repeat_url TEXT,
    audio_goodbye_url TEXT,

    -- Action configuration
    on_yes_action TEXT NOT NULL DEFAULT 'send_whatsapp',
    on_yes_template_name TEXT,
    on_yes_template_params JSONB,
    on_yes_media_url TEXT,
    aisensy_integration_id UUID REFERENCES organization_integrations(id),

    -- Speech detection config
    speech_language TEXT DEFAULT 'hi',
    speech_hints TEXT DEFAULT 'haan,yes,sure,ok,interested,bhej do,send,bilkul,zaroor,theek hai,nahi,no,not interested,nahi chahiye,busy,baad mein',
    positive_keywords TEXT DEFAULT 'haan,yes,sure,ok,interested,bhej,send,bilkul,zaroor,theek,chahiye,join,haa,kar do,bhejiye,bhej do',
    negative_keywords TEXT DEFAULT 'nahi,no,not,busy,baad,mat,nahi chahiye,not interested,band karo',

    -- VoBiz config
    vobiz_from_number TEXT NOT NULL,
    calls_per_second INTEGER DEFAULT 5,
    concurrent_limit INTEGER DEFAULT 10,

    -- Schedule
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,

    -- Counters
    total_contacts INTEGER DEFAULT 0,
    calls_initiated INTEGER DEFAULT 0,
    calls_answered INTEGER DEFAULT 0,
    calls_interested INTEGER DEFAULT 0,
    calls_not_interested INTEGER DEFAULT 0,
    calls_no_response INTEGER DEFAULT 0,
    calls_no_answer INTEGER DEFAULT 0,
    calls_busy INTEGER DEFAULT 0,
    calls_failed INTEGER DEFAULT 0,
    calls_voicemail INTEGER DEFAULT 0,
    total_duration_seconds NUMERIC DEFAULT 0,
    total_cost NUMERIC DEFAULT 0,

    -- Retry config
    retry_no_answer BOOLEAN DEFAULT true,
    max_retries INTEGER DEFAULT 1,
    retry_delay_minutes INTEGER DEFAULT 30,

    -- Metadata
    workshop_id UUID REFERENCES workshops(id),
    source_type TEXT DEFAULT 'csv',
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ivr_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ivr_campaigns_select" ON public.ivr_campaigns FOR SELECT
    USING (organization_id = ANY(get_user_organization_ids()));
CREATE POLICY "ivr_campaigns_insert" ON public.ivr_campaigns FOR INSERT
    WITH CHECK (organization_id = ANY(get_user_organization_ids()));
CREATE POLICY "ivr_campaigns_update" ON public.ivr_campaigns FOR UPDATE
    USING (organization_id = ANY(get_user_organization_ids()));

CREATE INDEX idx_ivr_campaigns_org_status ON public.ivr_campaigns(organization_id, status);
CREATE INDEX idx_ivr_campaigns_status ON public.ivr_campaigns(status);

ALTER PUBLICATION supabase_realtime ADD TABLE ivr_campaigns;

-- 2. ivr_campaign_calls
CREATE TABLE public.ivr_campaign_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES ivr_campaigns(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),

    contact_name TEXT,
    contact_phone TEXT NOT NULL,
    contact_data JSONB,

    status TEXT NOT NULL DEFAULT 'pending',
    outcome TEXT,

    vobiz_call_uuid TEXT,
    vobiz_from TEXT,
    vobiz_to TEXT,

    speech_transcript TEXT,
    speech_confidence NUMERIC,
    detected_input_type TEXT,

    call_duration_seconds NUMERIC DEFAULT 0,
    call_cost NUMERIC DEFAULT 0,
    hangup_cause TEXT,
    answered_by_voicemail BOOLEAN DEFAULT false,

    whatsapp_sent BOOLEAN DEFAULT false,
    whatsapp_sent_at TIMESTAMPTZ,
    whatsapp_error TEXT,

    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,

    queued_at TIMESTAMPTZ,
    initiated_at TIMESTAMPTZ,
    answered_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ivr_campaign_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ivr_campaign_calls_select" ON public.ivr_campaign_calls FOR SELECT
    USING (organization_id = ANY(get_user_organization_ids()));
CREATE POLICY "ivr_campaign_calls_insert" ON public.ivr_campaign_calls FOR INSERT
    WITH CHECK (organization_id = ANY(get_user_organization_ids()));
CREATE POLICY "ivr_campaign_calls_update" ON public.ivr_campaign_calls FOR UPDATE
    USING (organization_id = ANY(get_user_organization_ids()));

CREATE INDEX idx_ivr_calls_campaign_status ON public.ivr_campaign_calls(campaign_id, status);
CREATE INDEX idx_ivr_calls_status_retry ON public.ivr_campaign_calls(status, next_retry_at)
    WHERE status IN ('pending', 'queued');
CREATE INDEX idx_ivr_calls_vobiz_uuid ON public.ivr_campaign_calls(vobiz_call_uuid)
    WHERE vobiz_call_uuid IS NOT NULL;
CREATE INDEX idx_ivr_calls_phone ON public.ivr_campaign_calls(contact_phone);

ALTER PUBLICATION supabase_realtime ADD TABLE ivr_campaign_calls;

-- 3. ivr_audio_library
CREATE TABLE public.ivr_audio_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    description TEXT,
    audio_url TEXT NOT NULL,
    duration_seconds NUMERIC,
    language TEXT DEFAULT 'hi',
    audio_type TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ivr_audio_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ivr_audio_select" ON public.ivr_audio_library FOR SELECT
    USING (organization_id = ANY(get_user_organization_ids()));
CREATE POLICY "ivr_audio_insert" ON public.ivr_audio_library FOR INSERT
    WITH CHECK (organization_id = ANY(get_user_organization_ids()));
CREATE POLICY "ivr_audio_update" ON public.ivr_audio_library FOR UPDATE
    USING (organization_id = ANY(get_user_organization_ids()));
CREATE POLICY "ivr_audio_delete" ON public.ivr_audio_library FOR DELETE
    USING (organization_id = ANY(get_user_organization_ids()));

-- 4. Storage bucket for IVR audio (public so VoBiz can access)
INSERT INTO storage.buckets (id, name, public) VALUES ('ivr-audio', 'ivr-audio', true);

-- Storage RLS: org members can upload/manage their own audio
CREATE POLICY "ivr_audio_upload" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'ivr-audio' AND auth.uid() IS NOT NULL);
CREATE POLICY "ivr_audio_read" ON storage.objects FOR SELECT
    USING (bucket_id = 'ivr-audio');
CREATE POLICY "ivr_audio_delete_storage" ON storage.objects FOR DELETE
    USING (bucket_id = 'ivr-audio' AND auth.uid() IS NOT NULL);

-- 5. Atomic RPC Functions

CREATE OR REPLACE FUNCTION public.increment_ivr_campaign_counter(
    p_campaign_id UUID,
    p_counter_name TEXT,
    p_increment INTEGER DEFAULT 1
) RETURNS VOID AS $$
BEGIN
    EXECUTE format(
        'UPDATE public.ivr_campaigns SET %I = COALESCE(%I, 0) + $1, updated_at = now() WHERE id = $2',
        p_counter_name, p_counter_name
    ) USING p_increment, p_campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.add_ivr_campaign_cost(
    p_campaign_id UUID,
    p_cost NUMERIC,
    p_duration NUMERIC
) RETURNS VOID AS $$
BEGIN
    UPDATE public.ivr_campaigns
    SET total_cost = COALESCE(total_cost, 0) + p_cost,
        total_duration_seconds = COALESCE(total_duration_seconds, 0) + p_duration,
        updated_at = now()
    WHERE id = p_campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.transition_ivr_call(
    p_call_id UUID,
    p_new_status TEXT,
    p_outcome TEXT DEFAULT NULL,
    p_speech TEXT DEFAULT NULL,
    p_confidence NUMERIC DEFAULT NULL,
    p_duration NUMERIC DEFAULT NULL,
    p_cost NUMERIC DEFAULT NULL,
    p_hangup_cause TEXT DEFAULT NULL,
    p_vobiz_call_uuid TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE public.ivr_campaign_calls
    SET status = p_new_status,
        outcome = COALESCE(p_outcome, outcome),
        speech_transcript = COALESCE(p_speech, speech_transcript),
        speech_confidence = COALESCE(p_confidence, speech_confidence),
        call_duration_seconds = COALESCE(p_duration, call_duration_seconds),
        call_cost = COALESCE(p_cost, call_cost),
        hangup_cause = COALESCE(p_hangup_cause, hangup_cause),
        vobiz_call_uuid = COALESCE(p_vobiz_call_uuid, vobiz_call_uuid),
        completed_at = CASE WHEN p_new_status IN ('completed', 'no_answer', 'busy', 'failed', 'voicemail') THEN now() ELSE completed_at END,
        updated_at = now()
    WHERE id = p_call_id
    AND status NOT IN ('completed', 'no_answer', 'busy', 'failed', 'voicemail');

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
