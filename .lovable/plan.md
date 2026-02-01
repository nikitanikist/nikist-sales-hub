

# Fast2SMS Integration - Complete Architecture

## Understanding the Architecture Difference

### Current System (WhatsApp)
```text
Templates (created in CRM) → Sequences → Tags → Workshops
```

### New System (SMS)
```text
SMS Templates (fetched/synced from Fast2SMS DLT) → SMS Sequences → Tags → Workshops
                                                                    ↑
                                                          (same tags, multiple sequences)
```

**Key Insight**: A single Tag (e.g., "CryptoCloud") can have BOTH a WhatsApp sequence AND an SMS sequence attached to it.

---

## What I Need From You

### 1. Fast2SMS API Key
- Your API authorization key from Fast2SMS dashboard
- I'll store this as a backend secret

### 2. Sender ID
- Your registered 6-character DLT Sender ID (e.g., `NIKIST`)

### 3. About DLT Templates
Fast2SMS doesn't have a public API to fetch DLT templates automatically. Instead, we'll create a simple "Add SMS Template" form where you enter:
- **Template ID** (the numeric DLT ID from Fast2SMS)
- **Template Name** (friendly name like "Morning Reminder")
- **Template Content** (the exact text with `{#var1#}`, `{#var2#}` placeholders - for display only)
- **Variable Labels** (what each var means: var1=Name, var2=Workshop, etc.)

You only need to enter these ONCE per template. After that, they work exactly like WhatsApp templates.

---

## Database Schema Changes

### New Table: `sms_templates`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| organization_id | uuid | Organization reference |
| dlt_template_id | text | The Fast2SMS DLT template ID (numeric string) |
| name | text | Friendly name (e.g., "Morning Reminder") |
| content_preview | text | Template text for UI display |
| variables | jsonb | `[{key: "var1", label: "Customer Name"}, ...]` |
| is_active | boolean | Whether template is usable |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

### New Table: `sms_sequences` (separate from WhatsApp sequences)

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| organization_id | uuid | Organization reference |
| name | text | Sequence name (e.g., "Evening Workshop SMS") |
| description | text | Optional description |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

### New Table: `sms_sequence_steps`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| sequence_id | uuid | Reference to sms_sequences |
| template_id | uuid | Reference to sms_templates |
| send_time | time | When to send (e.g., "11:00:00") |
| time_label | text | Optional label (e.g., "Morning") |
| step_order | integer | Order in sequence |
| created_at | timestamptz | Creation timestamp |

### Modify Table: `workshop_tags`

Add column:
| Column | Type | Description |
|--------|------|-------------|
| sms_sequence_id | uuid (nullable) | Reference to sms_sequences |

This allows a tag to have both:
- `template_sequence_id` → WhatsApp sequence
- `sms_sequence_id` → SMS sequence

### New Table: `scheduled_sms_messages`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| organization_id | uuid | Organization reference |
| workshop_id | uuid | Workshop reference |
| lead_id | uuid | Recipient (for phone number lookup) |
| template_id | uuid | SMS template used |
| variable_values | jsonb | `{"var1": "John", "var2": "CryptoCloud"}` |
| scheduled_for | timestamptz | When to send |
| status | text | pending/sending/sent/failed/cancelled |
| sent_at | timestamptz | When actually sent |
| error_message | text | Error details if failed |
| fast2sms_request_id | text | API response ID for tracking |
| retry_count | integer | Retry attempts (max 3) |
| created_at | timestamptz | Creation timestamp |

---

## Settings UI Changes

### Settings → Notifications → New "SMS Templates" Tab

```text
┌─────────────────────────────────────────────────────────────────┐
│  Templates  |  Sequences  |  Tags  |  SMS Templates  |  SMS Sequences  │
└─────────────────────────────────────────────────────────────────┘

SMS Templates (Fetched from DLT)
───────────────────────────────────────────────────────────────────
  [+ Add Template]

  ┌───────────────────────────────────────────────────────────┐
  │ Morning Reminder           ID: 1707168640039182925        │
  │ "Dear {#var1#}, reminder for {#var2#} at {#var3#}..."     │
  │ Variables: var1=Name, var2=Workshop, var3=Time            │
  │                                            [Edit] [Delete]│
  └───────────────────────────────────────────────────────────┘
```

### Settings → Notifications → New "SMS Sequences" Tab

Same UI pattern as WhatsApp sequences, but:
- Select from SMS templates (not WhatsApp templates)
- Same time/label structure

### Settings → Notifications → Tags Tab (Modified)

```text
┌───────────────────────────────────────────────────────────────┐
│ Tag: CryptoCloud                                              │
│                                                               │
│ WhatsApp Sequence: [Evening Workshop v1    ▼]                 │
│ SMS Sequence:      [Evening SMS Reminders  ▼]                 │
│                                                               │
│ Color: [●] Description: [________________]                    │
│                                            [Save] [Cancel]    │
└───────────────────────────────────────────────────────────────┘
```

---

## Operations UI Changes

### Workshop Notification Page → SMS Tab

Replace the "Coming Soon" placeholder with:

```text
┌───────────────────────────────────────────────────────────────┐
│ SMS Notifications                                 Fast2SMS    │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ Today's Workshop: CryptoCloud Masterclass                     │
│ ├─ Tag: CryptoCloud                                          │
│ ├─ SMS Sequence: Evening SMS Reminders (3 messages)          │
│ └─ Registrants with phone: 47 / 52                           │
│                                                               │
│ [Run SMS Sequence]  [Send Now]                                │
│                                                               │
│ Message Checkpoints:                                          │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ 11:00 AM  Morning Reminder    ○ 47 Pending              │  │
│ │  1:00 PM  Afternoon Nudge     ○ 47 Pending              │  │
│ │  6:00 PM  Final Reminder      ○ 47 Pending              │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## Backend Functions

### New Edge Function: `process-sms-queue`

Runs every minute (cron job), similar to `process-whatsapp-queue`:

1. Fetch pending messages where `scheduled_for <= now()` and `status = 'pending'`
2. For each message:
   - Get lead's phone number
   - Get template's DLT ID and variable values
   - Call Fast2SMS API:
     ```javascript
     POST https://www.fast2sms.com/dev/bulkV2
     Headers: { "authorization": "API_KEY" }
     Body: {
       "route": "dlt",
       "sender_id": "NIKIST",
       "message": "1707168640039182925",  // DLT Template ID
       "variables_values": "John|CryptoCloud|7 PM",  // Pipe-separated
       "numbers": "9876543210"
     }
     ```
   - Update status to `sent` or `failed`
   - Store API response for debugging

---

## User Flow Summary

### One-Time Setup (Settings)
1. Add Fast2SMS API Key in Settings → Integrations
2. Add your DLT templates in Settings → Notifications → SMS Templates
3. Create SMS Sequences in Settings → Notifications → SMS Sequences
4. Assign SMS Sequence to Tags in Settings → Notifications → Tags

### Per Workshop (Operations)
1. Workshop is created with tag (e.g., "CryptoCloud")
2. Tag has both WhatsApp sequence AND SMS sequence
3. Go to Operations → Workshop Notification → SMS tab
4. Click "Run SMS Sequence"
5. System schedules individual SMS for each registrant with a phone number
6. Cron job processes and sends messages at scheduled times
7. Real-time status updates in UI

---

## Files to Create/Modify

| Category | File | Action |
|----------|------|--------|
| **Database** | Migration | Create 4 new tables, modify workshop_tags |
| **Backend** | `supabase/functions/process-sms-queue/index.ts` | Create cron job |
| **Hooks** | `src/hooks/useSMSTemplates.ts` | Create - CRUD for SMS templates |
| **Hooks** | `src/hooks/useSMSSequences.ts` | Create - CRUD for SMS sequences |
| **Hooks** | `src/hooks/useSMSNotification.ts` | Create - Schedule/track SMS |
| **Settings** | `src/pages/settings/WorkshopNotificationSettings.tsx` | Add SMS Templates & Sequences tabs |
| **Settings** | `src/components/settings/SMSIntegration.tsx` | Create - Fast2SMS config |
| **Operations** | `src/components/operations/notification-channels/SMSTab.tsx` | Create - Replace placeholder |
| **Types** | `src/hooks/useWorkshopTags.ts` | Add sms_sequence_id to interface |
| **Config** | `supabase/config.toml` | Add process-sms-queue function |

---

## Implementation Phases

### Phase 1: Database & Settings (~2 hours)
- Create database tables with RLS policies
- Add SMS Templates tab in settings
- Add SMS Sequences tab in settings
- Modify Tags to support SMS sequence

### Phase 2: Backend Processing (~1.5 hours)
- Create `process-sms-queue` edge function
- Set up cron job
- Handle Fast2SMS API calls

### Phase 3: Operations UI (~2 hours)
- Create SMSTab component
- Real-time message tracking
- Run sequence / Send now functionality

### Phase 4: Testing & Polish (~1 hour)
- End-to-end testing
- Error handling
- UI polish

**Total Estimated Time: 6-7 hours**

