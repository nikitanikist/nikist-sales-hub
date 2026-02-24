
-- WhatsApp sessions: fast webhook lookup by vps_session_id in JSONB
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_vps_id
  ON public.whatsapp_sessions((session_data->>'vps_session_id'));

-- WhatsApp sessions: phone + status for constraint-clearing queries
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_phone_status
  ON public.whatsapp_sessions(phone_number, status);

-- Leads: org + status composite for filtered queries
CREATE INDEX IF NOT EXISTS idx_leads_org_status
  ON public.leads(organization_id, status);

-- Call appointments: composite closer+status+date for closer metrics
CREATE INDEX IF NOT EXISTS idx_appointments_closer_status_date
  ON public.call_appointments(closer_id, status, scheduled_date DESC);

-- Call appointments: org+date for daily views
CREATE INDEX IF NOT EXISTS idx_appointments_org_date
  ON public.call_appointments(organization_id, scheduled_date DESC);

-- Refresh statistics for query planner
ANALYZE public.whatsapp_sessions;
ANALYZE public.leads;
ANALYZE public.call_appointments;
