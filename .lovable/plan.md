

# Dynamic AISensy Integration and Per-Closer Notification Settings

## Overview

Add a new **"AISensy"** sub-tab under Settings > Integrations (alongside Zoom, Calendly, WhatsApp, Pabbly) where any organization admin can manage AISensy accounts and configure per-closer notification templates, reminder timelines, and Zoom link inclusion -- all dynamically from the UI.

This is a multi-tenant feature available to all organizations, not just Nikist.

## What Exists Today

- **One WhatsApp integration record** in the database stores AISensy config (API key as secret reference, template names as flat strings, closer-specific video URLs). But the "WhatsApp" tab in Settings only shows the Baileys/VPS connection -- AISensy is invisible in the UI.
- **Three closers** (Aadesh, Akansha, Dipanshu) are mapped via `closer_integrations` to their Zoom/Calendly integrations, but have no per-closer notification config.
- **Reminders are broken** since Feb 3 -- the `send-whatsapp-reminder` function reads `config.api_key` but the database stores `api_key_secret` with `uses_env_secrets: true`, resulting in 401 errors.
- **Closer list is hardcoded** in `process-due-reminders` as a static `ENABLED_CLOSER_EMAILS` array.
- **Template names and reminder timings are hardcoded** in edge function code.

## What Will Change

### UI: New "AISensy" Integration Sub-Tab

Inside Settings > Integrations, the tab bar grows from 4 to 5 tabs:

**Zoom | Calendly | WhatsApp | AISensy | Pabbly**

The AISensy tab has three sections:

**Section A: AISensy Accounts**
- List of AISensy accounts for this organization (e.g., "Free Registrations - 8062960257" and "Paid Reminders - 9266395637")
- Each card: account name, masked API key, source number, active status
- Add / edit / delete / test connection
- Uses `organization_integrations` with `integration_type` starting with `aisensy`

**Section B: Closer Notification Configuration**
- One card per closer (dynamically fetched from `closer_integrations` -- no hardcoded names)
- Each closer card contains:
  - Dropdown to select which AISensy account sends their reminders
  - Per-reminder-type template name inputs (call_booked, 2 days, 1 day, 3 hours, 1 hour, 30 min, 10 min, we are live)
  - Video URL input (for call_booked video template)
  - Support number input
  - Toggle to include Zoom link in specific reminder types (defaults: 10 min and we_are_live)
  - Enable/disable toggle for reminders

**Section C: Variables Reference**
- Read-only card showing available template variables per reminder type (customer name, date, time, Zoom link, support number) so admins know what each AISensy template should expect

### Database Changes

**New table: `closer_notification_configs`**

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| organization_id | uuid | Tenant isolation |
| closer_id | uuid | Which closer |
| aisensy_integration_id | uuid | FK to organization_integrations (which AISensy account) |
| templates | jsonb | Map of reminder_type to template name |
| video_url | text | Video URL for call_booked template |
| support_number | text | Support number for templates |
| include_zoom_link_types | text[] | Which reminder types include the Zoom link |
| is_active | boolean | Enable/disable reminders for this closer |
| created_at | timestamptz | Auto |
| updated_at | timestamptz | Auto |

RLS: Org admins can manage, org members can view. Same pattern as other settings tables.

**New integration records**: The existing `whatsapp` integration stays for Baileys. AISensy accounts will use `integration_type = 'aisensy'` (or `'aisensy_<timestamp>'` for additional accounts), keeping the two systems separate.

### Backend Fix 1: `send-whatsapp-reminder`

**Secret resolution** (the critical bug causing all failures):
- When the AISensy integration config has `uses_env_secrets: true`, resolve `api_key` from `Deno.env.get(config.api_key_secret)` and `source` from `Deno.env.get(config.source_secret)`

**Dynamic closer lookup** (replaces hardcoded templates):
- Query `closer_notification_configs` for the appointment's closer
- If found and active: use that closer's AISensy account and templates
- If not found: fall back to organization-level config (current behavior, but with secrets resolved)

**Template normalization**:
- Handle both flat strings (`"cryptoreminder1days"`) from current DB config and objects (`{ name, isVideo }`) from the template config UI

**Zoom link injection**:
- Check the closer's `include_zoom_link_types` array; if the current `reminder_type` is in that array, include `appointment.zoom_link` in template params
- This already works for `ten_minutes` and `we_are_live` in current code -- the fix just makes it configurable

### Backend Fix 2: `process-due-reminders`

**Remove hardcoded `ENABLED_CLOSER_EMAILS` array**. Instead:
- For each due reminder, query `closer_notification_configs` for the closer
- If config exists and `is_active = true`: process the reminder
- If no config exists: mark as skipped

This means adding a new closer only requires creating their config in the UI.

### Backend Fix 3: `rebook-call` (Zoom secret resolution)

At line 576 where it reads `closerIntegration.config as ZoomConfig`:
- If `config.uses_env_secrets` is true, resolve `account_id`, `client_id`, `client_secret` from environment variables
- This fixes Zoom link creation on rebook for Aadesh

### Backend Fix 4: `create-zoom-link` (Zoom secret resolution)

Same fix as rebook-call at line 201.

### How Zoom Link Gets Into Notifications

The flow is already wired -- it just needs the API key fix and dynamic config:

1. **Aadesh (direct Zoom)**: `schedule-adesh-call` creates a Zoom meeting and stores `zoom_link` on the appointment. Already working.
2. **Akansha/Dipanshu (Calendly+Zoom)**: Calendly webhook stores the Zoom link from the event. Already working.
3. **Rebook for Aadesh**: `rebook-call` creates a new Zoom meeting -- broken due to secret resolution, will be fixed.
4. **Reminders**: `send-whatsapp-reminder` reads `appointment.zoom_link` and includes it in template params when the reminder type is in the closer's `include_zoom_link_types` array. Currently broken because the API key issue kills the function before it reaches this point. Once fixed, Zoom links flow through automatically.

## Files to Create

- `src/pages/settings/AISensySettings.tsx` -- new AISensy integration tab component

## Files to Modify

- `src/pages/OrganizationSettings.tsx` -- add "AISensy" sub-tab in integrations (grid-cols-4 becomes grid-cols-5), add `aisensy` to groupedIntegrations
- `src/components/settings/IntegrationSection.tsx` -- add `aisensy` type support (fields: API key, source number, support number, video URL)
- `src/components/settings/AddIntegrationDialog.tsx` -- add `aisensy` to `getFieldsForType` and `getTypeLabel`
- `supabase/functions/send-whatsapp-reminder/index.ts` -- secret resolution + dynamic closer config lookup + template normalization
- `supabase/functions/process-due-reminders/index.ts` -- remove hardcoded email list, use DB config
- `supabase/functions/rebook-call/index.ts` -- Zoom secret resolution fix
- `supabase/functions/create-zoom-link/index.ts` -- Zoom secret resolution fix

## What Will NOT Be Touched

- General settings tab
- Team tab (CloserAssignments component)
- Workshop Notifications tab
- WhatsApp tab (Baileys/VPS connection)
- Zoom integration tab
- Calendly integration tab
- Pabbly integration tab
- `schedule-adesh-call` function (already works)
- Calendly webhook functions (already work)
- Call scheduling UI, reminder timeline display in Assigned Calls

## Implementation Order

1. Database migration: create `closer_notification_configs` table with RLS
2. Create `AISensySettings.tsx` component
3. Update `OrganizationSettings.tsx` to add the new sub-tab
4. Update `AddIntegrationDialog.tsx` and `IntegrationSection.tsx` for `aisensy` type
5. Fix `send-whatsapp-reminder` (secret resolution + dynamic config)
6. Fix `process-due-reminders` (remove hardcoded emails)
7. Fix `rebook-call` (Zoom secret resolution)
8. Fix `create-zoom-link` (Zoom secret resolution)

