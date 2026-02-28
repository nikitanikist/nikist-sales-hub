

## Plan: Dynamic Registration Confirmation Rules (Zero Impact on Existing Integrations)

### Scope and Safety Guarantee

This feature **only adds** a new table and a new UI section. It **does not modify** any existing:
- WhatsApp session/VPS integration (`process-whatsapp-queue`, `process-notification-campaigns`, `vps-whatsapp-proxy`)
- Zoom integration (`create-zoom-link`, Zoom OAuth configs)
- Calendly integration (`calendly-webhook`, `schedule-calendly-call`)
- AISensy call reminder flow (`send-whatsapp-reminder`, `process-due-reminders`, `closer_notification_configs`)
- Existing `organization_integrations` table structure or data
- Any webhook endpoints other than `ingest-tagmango`

The **only file modified** on the backend is `ingest-tagmango/index.ts`, and the change is **additive** — it adds a database lookup *before* the existing hardcoded logic, falling back to the current behavior if no rule is found.

---

### Implementation Steps

#### 1. Create `registration_confirmation_rules` table

New table with columns: `organization_id`, `trigger_platform` (default `tagmango`), `trigger_id` (Mango ID), `label`, `is_active`, `aisensy_integration_id` (FK to `organization_integrations`), `template_name`, `variable_mapping` (JSONB ordered array), `google_sheet_webhook_url`, `sheet_send_duplicates`. RLS scoped to org admins.

#### 2. Seed existing hardcoded rules

Migration inserts the 2 current Nikist rules (Crypto + YouTube) into the new table, mapping them to the existing AISensy FREE integration.

#### 3. Update `ingest-tagmango` edge function (additive change only)

**Before** the existing `if (mangoId === TARGET_MANGO_ID_CRYPTO)` block (line 688), add:
- Query `registration_confirmation_rules` by `trigger_id = mangoId`
- If a matching active rule is found:
  - Resolve AISensy credentials from `organization_integrations` via `aisensy_integration_id`
  - Build `templateParams` from `variable_mapping` JSONB (resolving sources: `registrant_name`, `workshop_title`, `workshop_date`, `registrant_email`, `registrant_phone`, `static`)
  - Send AISensy API call + optional Google Sheet webhook
  - **Skip** the hardcoded block below (set a flag)
- If no rule found → **fall through to existing hardcoded logic unchanged** (safety net)

This means: even if the migration or seed data has an issue, the current behavior continues working exactly as before.

#### 4. Add UI in AISensy Settings

New "Registration Automations" card at the bottom of `AISensySettings.tsx`:
- Table listing existing rules
- "Add Rule" dialog with step-by-step fields:
  - Platform dropdown (TagMango only for now)
  - Product/Mango ID text input
  - Label text input
  - AISensy account dropdown (from existing org integrations)
  - Template name text input
  - Variable mapping: ordered rows ({{1}}, {{2}}, ...) each with source dropdown (`Registrant Name`, `Workshop Title`, `Workshop Date`, `Registrant Email`, `Registrant Phone`, `Static Value`) + text input for static values
  - Google Sheet webhook URL (optional)
  - "Send for duplicates" toggle
- Edit/delete/activate-deactivate existing rules

### Files Changed

| File | Change Type | Risk |
|---|---|---|
| Migration SQL | New table + seed | None — additive |
| `supabase/functions/ingest-tagmango/index.ts` | Add dynamic lookup before hardcoded block | Zero — falls back to existing code |
| `src/pages/settings/AISensySettings.tsx` | Add Registration Automations section | Zero — new UI section appended |
| `src/components/settings/RegistrationAutomationRules.tsx` | New component | None — new file |

### What Is NOT Touched

- `send-whatsapp-reminder` — call reminder flow unchanged
- `process-due-reminders` — reminder scheduling unchanged
- `closer_notification_configs` — closer configs unchanged
- `organization_integrations` — table/data unchanged
- `closer_integrations` — unchanged
- All WhatsApp VPS functions — unchanged
- All Zoom/Calendly functions — unchanged
- All campaign/queue processing — unchanged

