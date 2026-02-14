
-- Phase 3A: Critical indexes

-- leads
CREATE INDEX IF NOT EXISTS idx_leads_organization_id ON public.leads (organization_id);
CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads (email);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads (phone);
CREATE INDEX IF NOT EXISTS idx_leads_workshop_name ON public.leads (workshop_name);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON public.leads (assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads (status);

-- call_appointments
CREATE INDEX IF NOT EXISTS idx_call_appointments_organization_id ON public.call_appointments (organization_id);
CREATE INDEX IF NOT EXISTS idx_call_appointments_scheduled_date ON public.call_appointments (scheduled_date);
CREATE INDEX IF NOT EXISTS idx_call_appointments_closer_id ON public.call_appointments (closer_id);
CREATE INDEX IF NOT EXISTS idx_call_appointments_lead_id ON public.call_appointments (lead_id);
CREATE INDEX IF NOT EXISTS idx_call_appointments_status ON public.call_appointments (status);

-- emi_payments
CREATE INDEX IF NOT EXISTS idx_emi_payments_organization_id ON public.emi_payments (organization_id);
CREATE INDEX IF NOT EXISTS idx_emi_payments_appointment_id ON public.emi_payments (appointment_id);

-- lead_assignments
CREATE INDEX IF NOT EXISTS idx_lead_assignments_organization_id ON public.lead_assignments (organization_id);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_lead_id ON public.lead_assignments (lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_workshop_id ON public.lead_assignments (workshop_id);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_funnel_id ON public.lead_assignments (funnel_id);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_product_id ON public.lead_assignments (product_id);

-- workshops
CREATE INDEX IF NOT EXISTS idx_workshops_organization_id ON public.workshops (organization_id);

-- call_reminders
CREATE INDEX IF NOT EXISTS idx_call_reminders_status_reminder_time ON public.call_reminders (status, reminder_time);
CREATE INDEX IF NOT EXISTS idx_call_reminders_appointment_id ON public.call_reminders (appointment_id);

-- scheduled_whatsapp_messages (correct column name)
CREATE INDEX IF NOT EXISTS idx_scheduled_whatsapp_messages_status ON public.scheduled_whatsapp_messages (status);
CREATE INDEX IF NOT EXISTS idx_scheduled_whatsapp_messages_scheduled_for ON public.scheduled_whatsapp_messages (scheduled_for);

-- organization_members (critical for RLS)
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON public.organization_members (user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_organization_id ON public.organization_members (organization_id);

-- Phase 3B: Enable RLS on notification_campaign_reads
ALTER TABLE public.notification_campaign_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view campaign reads"
ON public.notification_campaign_reads
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.notification_campaign_groups ncg
    JOIN public.notification_campaigns nc ON nc.id = ncg.campaign_id
    WHERE ncg.id = notification_campaign_reads.campaign_group_id
      AND nc.organization_id = ANY(public.get_user_organization_ids())
  )
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Org members can insert campaign reads"
ON public.notification_campaign_reads
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.notification_campaign_groups ncg
    JOIN public.notification_campaigns nc ON nc.id = ncg.campaign_id
    WHERE ncg.id = notification_campaign_reads.campaign_group_id
      AND nc.organization_id = ANY(public.get_user_organization_ids())
  )
  OR public.is_super_admin(auth.uid())
);

-- Refresh statistics
ANALYZE public.leads;
ANALYZE public.call_appointments;
ANALYZE public.emi_payments;
ANALYZE public.lead_assignments;
ANALYZE public.workshops;
ANALYZE public.call_reminders;
ANALYZE public.organization_members;
ANALYZE public.scheduled_whatsapp_messages;
