-- 1. Create template_sequences table (no dependencies)
CREATE TABLE public.template_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

-- Enable RLS
ALTER TABLE public.template_sequences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for template_sequences
CREATE POLICY "Users can view sequences in their organization"
ON public.template_sequences FOR SELECT
USING ((organization_id = ANY (get_user_organization_ids())) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can create sequences in their organization"
ON public.template_sequences FOR INSERT
WITH CHECK (((organization_id = ANY (get_user_organization_ids())) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can update sequences in their organization"
ON public.template_sequences FOR UPDATE
USING (((organization_id = ANY (get_user_organization_ids())) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can delete sequences in their organization"
ON public.template_sequences FOR DELETE
USING (((organization_id = ANY (get_user_organization_ids())) AND has_role(auth.uid(), 'admin'::app_role)) OR is_super_admin(auth.uid()));

-- 2. Create template_sequence_steps table
CREATE TABLE public.template_sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES public.template_sequences(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.whatsapp_message_templates(id) ON DELETE CASCADE,
  send_time TIME NOT NULL,
  time_label TEXT,
  step_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(sequence_id, step_order)
);

-- Enable RLS
ALTER TABLE public.template_sequence_steps ENABLE ROW LEVEL SECURITY;

-- RLS Policies for template_sequence_steps (inherit from parent sequence)
CREATE POLICY "Users can view steps if they can view the sequence"
ON public.template_sequence_steps FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.template_sequences ts 
  WHERE ts.id = template_sequence_steps.sequence_id 
  AND ((ts.organization_id = ANY (get_user_organization_ids())) OR is_super_admin(auth.uid()))
));

CREATE POLICY "Admins can create steps in their sequences"
ON public.template_sequence_steps FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.template_sequences ts 
  WHERE ts.id = template_sequence_steps.sequence_id 
  AND ((ts.organization_id = ANY (get_user_organization_ids())) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)))
) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can update steps in their sequences"
ON public.template_sequence_steps FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.template_sequences ts 
  WHERE ts.id = template_sequence_steps.sequence_id 
  AND ((ts.organization_id = ANY (get_user_organization_ids())) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)))
) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can delete steps in their sequences"
ON public.template_sequence_steps FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.template_sequences ts 
  WHERE ts.id = template_sequence_steps.sequence_id 
  AND ((ts.organization_id = ANY (get_user_organization_ids())) AND has_role(auth.uid(), 'admin'::app_role))
) OR is_super_admin(auth.uid()));

-- 3. Create workshop_tags table
CREATE TABLE public.workshop_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#8B5CF6',
  description TEXT,
  template_sequence_id UUID REFERENCES public.template_sequences(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

-- Enable RLS
ALTER TABLE public.workshop_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workshop_tags
CREATE POLICY "Users can view tags in their organization"
ON public.workshop_tags FOR SELECT
USING ((organization_id = ANY (get_user_organization_ids())) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can create tags in their organization"
ON public.workshop_tags FOR INSERT
WITH CHECK (((organization_id = ANY (get_user_organization_ids())) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can update tags in their organization"
ON public.workshop_tags FOR UPDATE
USING (((organization_id = ANY (get_user_organization_ids())) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can delete tags in their organization"
ON public.workshop_tags FOR DELETE
USING (((organization_id = ANY (get_user_organization_ids())) AND has_role(auth.uid(), 'admin'::app_role)) OR is_super_admin(auth.uid()));

-- 4. Add columns to workshops table
ALTER TABLE public.workshops 
ADD COLUMN IF NOT EXISTS tag_id UUID REFERENCES public.workshop_tags(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS whatsapp_session_id UUID REFERENCES public.whatsapp_sessions(id) ON DELETE SET NULL;

-- 5. Create indexes for performance
CREATE INDEX idx_template_sequences_org ON public.template_sequences(organization_id);
CREATE INDEX idx_sequence_steps_sequence ON public.template_sequence_steps(sequence_id);
CREATE INDEX idx_workshop_tags_org ON public.workshop_tags(organization_id);
CREATE INDEX idx_workshop_tags_sequence ON public.workshop_tags(template_sequence_id);
CREATE INDEX idx_workshops_tag ON public.workshops(tag_id);
CREATE INDEX idx_workshops_wa_session ON public.workshops(whatsapp_session_id);

-- 6. Enable realtime for scheduled_whatsapp_messages (for real-time checkpoints)
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_whatsapp_messages;

-- 7. Add updated_at trigger for new tables
CREATE TRIGGER update_template_sequences_updated_at
  BEFORE UPDATE ON public.template_sequences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workshop_tags_updated_at
  BEFORE UPDATE ON public.workshop_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();