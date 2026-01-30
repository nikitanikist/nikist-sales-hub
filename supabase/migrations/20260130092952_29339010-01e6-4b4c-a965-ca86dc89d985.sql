-- =====================================================
-- Workshop Automation System - WhatsApp Group Integration
-- =====================================================

-- 1. WhatsApp Sessions (Store encrypted Baileys credentials - multi-account support)
CREATE TABLE public.whatsapp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  display_name TEXT,
  session_data JSONB,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'qr_pending', 'connecting')),
  qr_code TEXT,
  qr_expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, phone_number)
);

-- 2. WhatsApp Groups (Link groups to workshops)
CREATE TABLE public.whatsapp_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.whatsapp_sessions(id) ON DELETE CASCADE,
  group_jid TEXT NOT NULL,
  group_name TEXT NOT NULL,
  invite_link TEXT,
  workshop_id UUID REFERENCES public.workshops(id) ON DELETE SET NULL,
  participant_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, group_jid)
);

-- 3. Scheduled WhatsApp Messages (Message queue)
CREATE TABLE public.scheduled_whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.whatsapp_groups(id) ON DELETE CASCADE,
  workshop_id UUID REFERENCES public.workshops(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL,
  message_content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT CHECK (media_type IS NULL OR media_type IN ('image', 'video', 'document')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. WhatsApp Message Templates (Reusable templates)
CREATE TABLE public.whatsapp_message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  media_url TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Workshop Automation Config (Org-level settings)
CREATE TABLE public.workshop_automation_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  auto_schedule_messages BOOLEAN DEFAULT true,
  default_workshop_time TIME DEFAULT '19:00:00',
  message_schedule JSONB DEFAULT '{
    "morning": "11:00",
    "6hr_before": "13:00",
    "1hr_before": "18:00",
    "30min_before": "18:30",
    "we_are_live": "18:55"
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id)
);

-- 6. Add columns to workshops table
ALTER TABLE public.workshops 
ADD COLUMN IF NOT EXISTS whatsapp_group_id UUID REFERENCES public.whatsapp_groups(id) ON DELETE SET NULL;

ALTER TABLE public.workshops 
ADD COLUMN IF NOT EXISTS automation_status JSONB DEFAULT '{
  "whatsapp_group_linked": false,
  "messages_scheduled": false
}'::jsonb;

-- =====================================================
-- Indexes for performance
-- =====================================================

CREATE INDEX idx_wa_sessions_org ON public.whatsapp_sessions(organization_id);
CREATE INDEX idx_wa_sessions_status ON public.whatsapp_sessions(status);

CREATE INDEX idx_wa_groups_org ON public.whatsapp_groups(organization_id);
CREATE INDEX idx_wa_groups_workshop ON public.whatsapp_groups(workshop_id);
CREATE INDEX idx_wa_groups_session ON public.whatsapp_groups(session_id);

CREATE INDEX idx_scheduled_msgs_status_time ON public.scheduled_whatsapp_messages(status, scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_scheduled_msgs_org ON public.scheduled_whatsapp_messages(organization_id);
CREATE INDEX idx_scheduled_msgs_group ON public.scheduled_whatsapp_messages(group_id);

CREATE INDEX idx_wa_templates_org ON public.whatsapp_message_templates(organization_id);

CREATE INDEX idx_workshops_wa_group ON public.workshops(whatsapp_group_id);

-- =====================================================
-- Update triggers for updated_at columns
-- =====================================================

CREATE TRIGGER update_whatsapp_sessions_updated_at
  BEFORE UPDATE ON public.whatsapp_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_groups_updated_at
  BEFORE UPDATE ON public.whatsapp_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_message_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_message_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workshop_automation_config_updated_at
  BEFORE UPDATE ON public.workshop_automation_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- Enable Row Level Security
-- =====================================================

ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshop_automation_config ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS Policies for whatsapp_sessions
-- =====================================================

CREATE POLICY "Super admins can manage all whatsapp sessions"
ON public.whatsapp_sessions FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Org admins can manage whatsapp sessions in their organization"
ON public.whatsapp_sessions FOR ALL
USING (
  (organization_id = ANY (get_user_organization_ids()))
  AND is_org_admin(auth.uid(), organization_id)
);

CREATE POLICY "Users can view whatsapp sessions in their organization"
ON public.whatsapp_sessions FOR SELECT
USING (
  (organization_id = ANY (get_user_organization_ids()))
  OR is_super_admin(auth.uid())
);

-- =====================================================
-- RLS Policies for whatsapp_groups
-- =====================================================

CREATE POLICY "Super admins can manage all whatsapp groups"
ON public.whatsapp_groups FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Org admins can manage whatsapp groups in their organization"
ON public.whatsapp_groups FOR ALL
USING (
  (organization_id = ANY (get_user_organization_ids()))
  AND is_org_admin(auth.uid(), organization_id)
);

CREATE POLICY "Users can view whatsapp groups in their organization"
ON public.whatsapp_groups FOR SELECT
USING (
  (organization_id = ANY (get_user_organization_ids()))
  OR is_super_admin(auth.uid())
);

-- =====================================================
-- RLS Policies for scheduled_whatsapp_messages
-- =====================================================

CREATE POLICY "Super admins can manage all scheduled messages"
ON public.scheduled_whatsapp_messages FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Org admins can manage scheduled messages in their organization"
ON public.scheduled_whatsapp_messages FOR ALL
USING (
  (organization_id = ANY (get_user_organization_ids()))
  AND is_org_admin(auth.uid(), organization_id)
);

CREATE POLICY "Users can view scheduled messages in their organization"
ON public.scheduled_whatsapp_messages FOR SELECT
USING (
  (organization_id = ANY (get_user_organization_ids()))
  OR is_super_admin(auth.uid())
);

-- =====================================================
-- RLS Policies for whatsapp_message_templates
-- =====================================================

CREATE POLICY "Super admins can manage all message templates"
ON public.whatsapp_message_templates FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Org admins can manage templates in their organization"
ON public.whatsapp_message_templates FOR ALL
USING (
  (organization_id = ANY (get_user_organization_ids()))
  AND is_org_admin(auth.uid(), organization_id)
);

CREATE POLICY "Users can view templates in their organization"
ON public.whatsapp_message_templates FOR SELECT
USING (
  (organization_id = ANY (get_user_organization_ids()))
  OR is_super_admin(auth.uid())
);

-- =====================================================
-- RLS Policies for workshop_automation_config
-- =====================================================

CREATE POLICY "Super admins can manage all automation configs"
ON public.workshop_automation_config FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Org admins can manage automation config in their organization"
ON public.workshop_automation_config FOR ALL
USING (
  (organization_id = ANY (get_user_organization_ids()))
  AND is_org_admin(auth.uid(), organization_id)
);

CREATE POLICY "Users can view automation config in their organization"
ON public.workshop_automation_config FOR SELECT
USING (
  (organization_id = ANY (get_user_organization_ids()))
  OR is_super_admin(auth.uid())
);