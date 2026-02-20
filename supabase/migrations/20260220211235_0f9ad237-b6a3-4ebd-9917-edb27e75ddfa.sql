
-- Create webinars table
CREATE TABLE public.webinars (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  tag_id UUID REFERENCES public.workshop_tags(id),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  whatsapp_group_id UUID REFERENCES public.whatsapp_groups(id),
  whatsapp_session_id UUID REFERENCES public.whatsapp_sessions(id),
  community_group_id UUID REFERENCES public.whatsapp_groups(id),
  automation_status JSONB NOT NULL DEFAULT '{"whatsapp_group_linked": false, "messages_scheduled": false}',
  status TEXT NOT NULL DEFAULT 'planned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create webinar_whatsapp_groups junction table
CREATE TABLE public.webinar_whatsapp_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webinar_id UUID NOT NULL REFERENCES public.webinars(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.whatsapp_groups(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create scheduled_webinar_messages table
CREATE TABLE public.scheduled_webinar_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  group_id UUID NOT NULL REFERENCES public.whatsapp_groups(id),
  webinar_id UUID NOT NULL REFERENCES public.webinars(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL,
  message_content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create webinar_sequence_variables table
CREATE TABLE public.webinar_sequence_variables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webinar_id UUID NOT NULL REFERENCES public.webinars(id) ON DELETE CASCADE,
  variable_key TEXT NOT NULL,
  variable_value TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_webinars_org ON public.webinars(organization_id);
CREATE INDEX idx_webinars_tag ON public.webinars(tag_id);
CREATE INDEX idx_webinar_whatsapp_groups_webinar ON public.webinar_whatsapp_groups(webinar_id);
CREATE INDEX idx_scheduled_webinar_messages_status ON public.scheduled_webinar_messages(status, scheduled_for);
CREATE INDEX idx_scheduled_webinar_messages_webinar ON public.scheduled_webinar_messages(webinar_id);
CREATE INDEX idx_webinar_sequence_variables_webinar ON public.webinar_sequence_variables(webinar_id);

-- Enable RLS
ALTER TABLE public.webinars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webinar_whatsapp_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_webinar_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webinar_sequence_variables ENABLE ROW LEVEL SECURITY;

-- RLS Policies for webinars
CREATE POLICY "Users can view webinars in their org" ON public.webinars
  FOR SELECT USING (organization_id = ANY(public.get_user_organization_ids()));

CREATE POLICY "Users can create webinars in their org" ON public.webinars
  FOR INSERT WITH CHECK (organization_id = ANY(public.get_user_organization_ids()));

CREATE POLICY "Users can update webinars in their org" ON public.webinars
  FOR UPDATE USING (organization_id = ANY(public.get_user_organization_ids()));

CREATE POLICY "Users can delete webinars in their org" ON public.webinars
  FOR DELETE USING (organization_id = ANY(public.get_user_organization_ids()));

-- RLS Policies for webinar_whatsapp_groups
CREATE POLICY "Users can view webinar groups in their org" ON public.webinar_whatsapp_groups
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.webinars w WHERE w.id = webinar_id AND w.organization_id = ANY(public.get_user_organization_ids())));

CREATE POLICY "Users can manage webinar groups in their org" ON public.webinar_whatsapp_groups
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.webinars w WHERE w.id = webinar_id AND w.organization_id = ANY(public.get_user_organization_ids())));

CREATE POLICY "Users can delete webinar groups in their org" ON public.webinar_whatsapp_groups
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.webinars w WHERE w.id = webinar_id AND w.organization_id = ANY(public.get_user_organization_ids())));

-- RLS Policies for scheduled_webinar_messages
CREATE POLICY "Users can view webinar messages in their org" ON public.scheduled_webinar_messages
  FOR SELECT USING (organization_id = ANY(public.get_user_organization_ids()));

CREATE POLICY "Users can create webinar messages in their org" ON public.scheduled_webinar_messages
  FOR INSERT WITH CHECK (organization_id = ANY(public.get_user_organization_ids()));

CREATE POLICY "Users can update webinar messages in their org" ON public.scheduled_webinar_messages
  FOR UPDATE USING (organization_id = ANY(public.get_user_organization_ids()));

CREATE POLICY "Users can delete webinar messages in their org" ON public.scheduled_webinar_messages
  FOR DELETE USING (organization_id = ANY(public.get_user_organization_ids()));

-- RLS Policies for webinar_sequence_variables
CREATE POLICY "Users can view webinar variables in their org" ON public.webinar_sequence_variables
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.webinars w WHERE w.id = webinar_id AND w.organization_id = ANY(public.get_user_organization_ids())));

CREATE POLICY "Users can manage webinar variables in their org" ON public.webinar_sequence_variables
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.webinars w WHERE w.id = webinar_id AND w.organization_id = ANY(public.get_user_organization_ids())));

CREATE POLICY "Users can update webinar variables in their org" ON public.webinar_sequence_variables
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.webinars w WHERE w.id = webinar_id AND w.organization_id = ANY(public.get_user_organization_ids())));

CREATE POLICY "Users can delete webinar variables in their org" ON public.webinar_sequence_variables
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.webinars w WHERE w.id = webinar_id AND w.organization_id = ANY(public.get_user_organization_ids())));

-- Triggers for updated_at
CREATE TRIGGER update_webinars_updated_at
  BEFORE UPDATE ON public.webinars
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_webinar_sequence_variables_updated_at
  BEFORE UPDATE ON public.webinar_sequence_variables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for scheduled_webinar_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_webinar_messages;
