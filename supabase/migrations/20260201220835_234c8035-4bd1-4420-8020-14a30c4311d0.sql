-- ================================================================
-- SMS INTEGRATION TABLES
-- ================================================================

-- Table: sms_templates (pre-approved DLT templates from Fast2SMS)
CREATE TABLE public.sms_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    dlt_template_id TEXT NOT NULL,
    name TEXT NOT NULL,
    content_preview TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(organization_id, dlt_template_id)
);

-- Enable RLS
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sms_templates
CREATE POLICY "Users can view SMS templates in their org"
ON public.sms_templates FOR SELECT
USING ((organization_id = ANY (get_user_organization_ids())) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can create SMS templates in their org"
ON public.sms_templates FOR INSERT
WITH CHECK (((organization_id = ANY (get_user_organization_ids())) AND (has_org_role(auth.uid(), 'admin'::app_role) OR has_org_role(auth.uid(), 'manager'::app_role))) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can update SMS templates in their org"
ON public.sms_templates FOR UPDATE
USING (((organization_id = ANY (get_user_organization_ids())) AND (has_org_role(auth.uid(), 'admin'::app_role) OR has_org_role(auth.uid(), 'manager'::app_role))) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can delete SMS templates in their org"
ON public.sms_templates FOR DELETE
USING (((organization_id = ANY (get_user_organization_ids())) AND has_org_role(auth.uid(), 'admin'::app_role)) OR is_super_admin(auth.uid()));

-- ================================================================
-- Table: sms_sequences (collection of SMS steps)
CREATE TABLE public.sms_sequences (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sms_sequences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sms_sequences
CREATE POLICY "Users can view SMS sequences in their org"
ON public.sms_sequences FOR SELECT
USING ((organization_id = ANY (get_user_organization_ids())) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can create SMS sequences in their org"
ON public.sms_sequences FOR INSERT
WITH CHECK (((organization_id = ANY (get_user_organization_ids())) AND (has_org_role(auth.uid(), 'admin'::app_role) OR has_org_role(auth.uid(), 'manager'::app_role))) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can update SMS sequences in their org"
ON public.sms_sequences FOR UPDATE
USING (((organization_id = ANY (get_user_organization_ids())) AND (has_org_role(auth.uid(), 'admin'::app_role) OR has_org_role(auth.uid(), 'manager'::app_role))) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can delete SMS sequences in their org"
ON public.sms_sequences FOR DELETE
USING (((organization_id = ANY (get_user_organization_ids())) AND has_org_role(auth.uid(), 'admin'::app_role)) OR is_super_admin(auth.uid()));

-- ================================================================
-- Table: sms_sequence_steps (individual steps in a sequence)
CREATE TABLE public.sms_sequence_steps (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    sequence_id UUID NOT NULL REFERENCES public.sms_sequences(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES public.sms_templates(id) ON DELETE CASCADE,
    send_time TIME WITHOUT TIME ZONE NOT NULL,
    time_label TEXT,
    step_order INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sms_sequence_steps ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sms_sequence_steps
CREATE POLICY "Users can view SMS sequence steps if they can view the sequence"
ON public.sms_sequence_steps FOR SELECT
USING (EXISTS (
    SELECT 1 FROM sms_sequences s
    WHERE s.id = sms_sequence_steps.sequence_id
    AND ((s.organization_id = ANY (get_user_organization_ids())) OR is_super_admin(auth.uid()))
));

CREATE POLICY "Admins can create SMS sequence steps"
ON public.sms_sequence_steps FOR INSERT
WITH CHECK ((EXISTS (
    SELECT 1 FROM sms_sequences s
    WHERE s.id = sms_sequence_steps.sequence_id
    AND s.organization_id = ANY (get_user_organization_ids())
    AND (has_org_role(auth.uid(), 'admin'::app_role) OR has_org_role(auth.uid(), 'manager'::app_role))
)) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can update SMS sequence steps"
ON public.sms_sequence_steps FOR UPDATE
USING ((EXISTS (
    SELECT 1 FROM sms_sequences s
    WHERE s.id = sms_sequence_steps.sequence_id
    AND s.organization_id = ANY (get_user_organization_ids())
    AND (has_org_role(auth.uid(), 'admin'::app_role) OR has_org_role(auth.uid(), 'manager'::app_role))
)) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can delete SMS sequence steps"
ON public.sms_sequence_steps FOR DELETE
USING ((EXISTS (
    SELECT 1 FROM sms_sequences s
    WHERE s.id = sms_sequence_steps.sequence_id
    AND s.organization_id = ANY (get_user_organization_ids())
    AND has_org_role(auth.uid(), 'admin'::app_role)
)) OR is_super_admin(auth.uid()));

-- ================================================================
-- Modify workshop_tags to support SMS sequences
ALTER TABLE public.workshop_tags 
ADD COLUMN sms_sequence_id UUID REFERENCES public.sms_sequences(id) ON DELETE SET NULL;

-- ================================================================
-- Table: scheduled_sms_messages (queue for individual SMS delivery)
CREATE TABLE public.scheduled_sms_messages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES public.sms_templates(id) ON DELETE RESTRICT,
    variable_values JSONB DEFAULT '{}'::jsonb,
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled')),
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    fast2sms_request_id TEXT,
    retry_count INTEGER DEFAULT 0,
    message_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_sms_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for scheduled_sms_messages
CREATE POLICY "Users can view scheduled SMS in their org"
ON public.scheduled_sms_messages FOR SELECT
USING ((organization_id = ANY (get_user_organization_ids())) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can create scheduled SMS in their org"
ON public.scheduled_sms_messages FOR INSERT
WITH CHECK (((organization_id = ANY (get_user_organization_ids())) AND (has_org_role(auth.uid(), 'admin'::app_role) OR has_org_role(auth.uid(), 'manager'::app_role))) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can update scheduled SMS in their org"
ON public.scheduled_sms_messages FOR UPDATE
USING (((organization_id = ANY (get_user_organization_ids())) AND (has_org_role(auth.uid(), 'admin'::app_role) OR has_org_role(auth.uid(), 'manager'::app_role))) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can delete scheduled SMS in their org"
ON public.scheduled_sms_messages FOR DELETE
USING (((organization_id = ANY (get_user_organization_ids())) AND has_org_role(auth.uid(), 'admin'::app_role)) OR is_super_admin(auth.uid()));

-- Create indexes for better performance
CREATE INDEX idx_scheduled_sms_status_scheduled ON public.scheduled_sms_messages(status, scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_scheduled_sms_workshop ON public.scheduled_sms_messages(workshop_id);
CREATE INDEX idx_sms_templates_org ON public.sms_templates(organization_id);
CREATE INDEX idx_sms_sequences_org ON public.sms_sequences(organization_id);

-- Enable realtime for scheduled_sms_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_sms_messages;