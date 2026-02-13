
-- Table 1: notification_campaigns
CREATE TABLE public.notification_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  session_id uuid NOT NULL,
  name text NOT NULL,
  message_content text NOT NULL,
  media_url text,
  media_type text,
  delay_seconds integer NOT NULL DEFAULT 1,
  scheduled_for timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  total_groups integer NOT NULL DEFAULT 0,
  total_audience integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage campaigns in their org"
  ON public.notification_campaigns FOR ALL
  USING (
    ((organization_id = ANY (get_user_organization_ids()))
      AND (has_org_role(auth.uid(), 'admin'::app_role) OR has_org_role(auth.uid(), 'manager'::app_role)))
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Users can view campaigns in their org"
  ON public.notification_campaigns FOR SELECT
  USING (
    (organization_id = ANY (get_user_organization_ids()))
    OR is_super_admin(auth.uid())
  );

-- Table 2: notification_campaign_groups
CREATE TABLE public.notification_campaign_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.notification_campaigns(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.whatsapp_groups(id),
  group_jid text NOT NULL,
  group_name text NOT NULL,
  member_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  message_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_campaign_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage campaign groups"
  ON public.notification_campaign_groups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.notification_campaigns nc
      WHERE nc.id = notification_campaign_groups.campaign_id
        AND ((nc.organization_id = ANY (get_user_organization_ids())
              AND (has_org_role(auth.uid(), 'admin'::app_role) OR has_org_role(auth.uid(), 'manager'::app_role)))
             OR is_super_admin(auth.uid()))
    )
  );

CREATE POLICY "Users can view campaign groups in their org"
  ON public.notification_campaign_groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.notification_campaigns nc
      WHERE nc.id = notification_campaign_groups.campaign_id
        AND ((nc.organization_id = ANY (get_user_organization_ids()))
             OR is_super_admin(auth.uid()))
    )
  );

-- Table 3: whatsapp_group_admins
CREATE TABLE public.whatsapp_group_admins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.whatsapp_groups(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  phone text NOT NULL,
  is_super_admin boolean NOT NULL DEFAULT false,
  synced_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_group_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage group admins cache"
  ON public.whatsapp_group_admins FOR ALL
  USING (
    ((organization_id = ANY (get_user_organization_ids()))
      AND (has_org_role(auth.uid(), 'admin'::app_role) OR has_org_role(auth.uid(), 'manager'::app_role)))
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Users can view group admins in their org"
  ON public.whatsapp_group_admins FOR SELECT
  USING (
    (organization_id = ANY (get_user_organization_ids()))
    OR is_super_admin(auth.uid())
  );

-- Add index for campaign processing
CREATE INDEX idx_notification_campaigns_status ON public.notification_campaigns(status);
CREATE INDEX idx_notification_campaign_groups_campaign_status ON public.notification_campaign_groups(campaign_id, status);
CREATE INDEX idx_whatsapp_group_admins_group ON public.whatsapp_group_admins(group_id);
