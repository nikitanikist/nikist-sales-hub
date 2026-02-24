

# Add Missing Performance Indexes

## Status of All 7 Tasks

| # | Task | Status |
|---|------|--------|
| 1 | whatsapp-status-webhook | Already deployed and working |
| 2 | Database sync (4 sessions) | All 4 sessions already show `connected` |
| 3 | VPS health check in CRM | Already implemented (page-load + refresh button) |
| 4 | Remove hardcoded API keys | Already using `WEBHOOK_SECRET_KEY` env var |
| 5 | Database indexes | **Partially done -- a few missing** |
| 6 | useToast memory leak | Already fixed (empty `[]` dependency) |
| 7 | Calendly webhook idempotency | Already using upsert with unique constraint |

## What Still Needs Doing

### Add missing composite indexes for performance

The following indexes already exist:
- `idx_leads_email`, `idx_leads_phone`, `idx_leads_status`, `idx_leads_org_created_desc`
- `idx_appointments_closer`, `idx_appointments_date`, `idx_appointments_status`
- `idx_emi_payments_appointment`, `idx_emi_payments_organization_id`

The following are **missing** and would improve performance:

```sql
-- WhatsApp sessions: fast webhook lookup by vps_session_id in JSONB
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_sessions_vps_id
  ON public.whatsapp_sessions((session_data->>'vps_session_id'));

-- WhatsApp sessions: phone + status for constraint-clearing queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_sessions_phone_status
  ON public.whatsapp_sessions(phone_number, status);

-- Leads: org + status composite for filtered queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_org_status
  ON public.leads(organization_id, status);

-- EMI payments: pending due date for reminder processing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_emi_pending_due
  ON public.emi_payments(due_date) WHERE payment_status = 'pending';

-- EMI payments: student + status for detail pages
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_emi_student_status
  ON public.emi_payments(student_id, payment_status);

-- Call appointments: composite closer+status+date for closer metrics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_closer_status_date
  ON public.call_appointments(closer_id, status, scheduled_date DESC);

-- Call appointments: org+date for daily views
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_org_date
  ON public.call_appointments(organization_id, scheduled_date DESC);
```

### Technical Details

- Uses `CREATE INDEX CONCURRENTLY` so the tables remain fully available during index creation
- All indexes are `IF NOT EXISTS` for safety
- The `idx_whatsapp_sessions_vps_id` index is especially important since every webhook call does a JSONB text lookup
- The partial index `idx_emi_pending_due` only indexes pending payments, keeping it small and fast

