

# Calling Module - Bolna AI Voice Campaign Integration

## Overview

Build a complete "Calling" module in TagFunnel that integrates with Bolna AI to enable AI-powered voice calling campaigns. This includes sidebar navigation, three frontend pages, two database tables, and three edge functions.

## Phase 1: Database Setup

### New Tables

**`voice_campaigns`** - Stores campaign metadata, status, and aggregate counters.

Key columns: `organization_id`, `name`, `status` (draft/scheduled/running/paused/completed/failed), `bolna_agent_id`, `bolna_batch_id`, `workshop_id`, `workshop_time`, `workshop_name`, `whatsapp_template_id`, `scheduled_at`, counter fields (`total_contacts`, `calls_completed`, `calls_confirmed`, `calls_rescheduled`, `calls_not_interested`, `calls_no_answer`, `calls_failed`), `total_cost`.

**`voice_campaign_calls`** - Individual call records with real-time status updates.

Key columns: `campaign_id`, `organization_id`, `lead_id`, `contact_name`, `contact_phone`, `status` (pending/queued/ringing/in-progress/completed/busy/no-answer/failed/cancelled), `outcome` (confirmed/rescheduled/not_interested/angry/wrong_number/voicemail/no_response), `reschedule_day`, `in_whatsapp_group`, `whatsapp_link_sent`, `bolna_call_id`, `call_duration_seconds`, `total_cost`, `transcript`, `recording_url`, `extracted_data` (JSONB).

**RLS Policies**: Organization-scoped access using the existing `organization_members` pattern.

**Realtime**: Both tables added to `supabase_realtime` publication for live dashboard updates.

**Database function**: `increment_campaign_counter(campaign_id, field)` to atomically update campaign counters from edge functions.

### Permissions & Modules

- Add `calling` to `PERMISSION_KEYS` in `src/lib/permissions.ts`
- Map `/calling/dashboard` and `/calling/campaigns` routes to the `calling` permission
- No new module slug needed initially -- will be gated by the `calling` permission key like WhatsApp/Webinar

## Phase 2: Backend (Edge Functions)

### Secrets Required

Three new secrets need to be configured before edge functions can work:
- `BOLNA_API_KEY` - Bolna API key for batch operations
- `BOLNA_AGENT_ID` - Default Bolna agent ID
- `BOLNA_WEBHOOK_SECRET` - Shared secret for webhook authentication

### Edge Function 1: `start-voice-campaign`

- **Trigger**: POST from frontend (authenticated) or future cron for scheduled campaigns
- **Flow**:
  1. Fetch campaign + all pending calls
  2. Generate CSV: `contact_number,lead_name,workshop_time,call_id`
  3. POST to `https://api.bolna.ai/batches` with agent_id + CSV file
  4. POST to `https://api.bolna.ai/batches/{batch_id}/schedule` (immediate or scheduled_at)
  5. Update campaign: `status='running'`, save `bolna_batch_id`
  6. Update all calls: `status='queued'`
- Uses `fetchWithRetry` with 15s timeout for Bolna API calls
- Config in `supabase/config.toml`: `verify_jwt = false` (auth checked in code via `getClaims`)

### Edge Function 2: `bolna-webhook`

- **Trigger**: POST from Bolna (public endpoint, no Supabase auth)
- **Auth**: Verify `Authorization: Bearer {BOLNA_WEBHOOK_SECRET}` header
- **Handles two payload types**:

  **Type A - Tool calls** (during conversation): Differentiated by `tool_name` field
  - `mark_attendance`: Update call outcome + increment campaign counter
  - `reschedule_lead`: Set outcome=rescheduled, store reschedule_day
  - `send_whatsapp_group_link`: Look up workshop's WhatsApp link, send via AiSensy API using campaign's template, set `whatsapp_link_sent=true`

  **Type B - Post-call webhook**: Differentiated by `status` field + no `tool_name`
  - Match call by `bolna_call_id` or phone number + batch
  - Update: duration, cost, transcript, recording_url, extracted_data
  - If no outcome was set during call, derive from extracted_data or set `no_response`
  - Check if all calls completed -> mark campaign as `completed`
  - Increment campaign `total_cost`

- Uses service role key (bypasses RLS)
- Config: `verify_jwt = false`

### Edge Function 3: `stop-voice-campaign`

- **Trigger**: POST from frontend (authenticated)
- **Flow**:
  1. POST to `https://api.bolna.ai/batches/{batch_id}/stop`
  2. Update campaign status to `paused`
  3. Update all pending/queued calls to `cancelled`

## Phase 3: Frontend

### File Structure

```text
src/pages/calling/
  CallingDashboard.tsx         -- Summary cards + recent campaigns
  CallingCampaigns.tsx         -- Filterable campaigns list
  CallingCampaignDetail.tsx    -- Real-time campaign detail
  CreateBroadcastDialog.tsx    -- Multi-step create flow (dialog)
  components/
    CampaignAnalyticsCards.tsx -- Stats cards grid
    CampaignCallsTable.tsx    -- Real-time calls table with search
    CampaignProgressBar.tsx   -- Visual progress bar
    CsvUploader.tsx           -- CSV upload, parse, validate
    WorkshopSelector.tsx      -- Workshop dropdown with lead count
    TranscriptDialog.tsx      -- View call transcript dialog
    index.ts                  -- Barrel exports

src/hooks/
  useVoiceCampaigns.ts        -- Fetch campaigns list (useQuery)
  useVoiceCampaignDetail.ts   -- Fetch single campaign + calls
  useVoiceCampaignRealtime.ts -- Supabase Realtime subscription
  useCreateBroadcast.ts       -- Mutation: create campaign + calls + start

src/types/
  voice-campaign.ts           -- TypeScript interfaces
```

### Sidebar Changes (`src/components/AppLayout.tsx`)

Add a new "Calling" group in the `allMenuItems` array (after WhatsApp), using the `Phone` icon from lucide-react:

```text
Calling (Phone icon)
  +-- Dashboard     -> /calling/dashboard
  +-- Campaigns     -> /calling/campaigns
```

Gated by `permissionKey: 'calling'`.

### Route Changes (`src/App.tsx`)

Add three new routes inside the AppLayout:
- `/calling/dashboard` -> `CallingDashboard`
- `/calling/campaigns` -> `CallingCampaigns`
- `/calling/campaigns/:campaignId` -> `CallingCampaignDetail`

All wrapped in `<ProtectedRoute>` with the `calling` permission.

### Page: Calling Dashboard (`/calling/dashboard`)

- Summary cards: Total Campaigns, Active, Scheduled, Completed, Total Calls Made, Total Cost
- Recent campaigns table (latest 10)
- "Create Calling Broadcast" button (top right) opens `CreateBroadcastDialog`

### Page: Create Broadcast Dialog (multi-step)

4-step dialog:

1. **Contact Source**: Radio toggle between "Select Workshop" (dropdown of org workshops, shows lead count preview) and "Upload CSV" (file upload with client-side parsing/validation: name+phone required, +91 validation, dedup, max 10k)
2. **Confirm Variables**: Campaign name (auto-generated, editable), workshop name, workshop time, Bolna Agent dropdown (hardcoded "Workshop Reminder Agent" for now)
3. **AiSensy Template**: Text input for WhatsApp template name/ID
4. **Schedule**: "Start Now" or "Schedule" with date-time picker, then "Initiate Calling" button

On submit: creates `voice_campaigns` record (draft), bulk-inserts `voice_campaign_calls`, then calls `start-voice-campaign` edge function (or sets scheduled status).

### Page: Campaigns List (`/calling/campaigns`)

- Filter tabs: All | In Progress | Scheduled | Completed | Failed
- Table columns: Campaign Name, Date, Total Contacts, Calls Completed, Outcomes (Confirmed/Rescheduled/Not Interested), Status badge, Total Cost, Actions (View, Stop)
- Click row -> navigate to detail page

### Page: Campaign Detail (`/calling/campaigns/:id`)

- **Analytics cards grid** (10 cards): Total Contacts, Calls Completed, Confirmed, Rescheduled, Not Interested, No Answer, Angry/DND, Failed, Total Cost, Avg Duration
- **Progress bar**: completion percentage with animated fill
- **Calls table**: #, Name, Phone (masked: 98765***10), Status (color-coded badge with pulse for active), Outcome, Reschedule Day, WhatsApp Group, Duration, Cost, Transcript (View button opens TranscriptDialog)
- **Real-time**: Subscribe to `voice_campaign_calls` and `voice_campaigns` via Supabase Realtime, filtered by campaign_id. Rows update live as Bolna webhooks fire.
- Search by name/phone, sortable columns
- Default sort: calling first, then pending, then completed

### Status/Outcome Badge Colors

Statuses: pending(gray), queued(light-blue), ringing/calling(blue+pulse), in-progress(blue), completed(green), no-answer(orange), busy(yellow), failed(red)

Outcomes: confirmed(green+check), rescheduled(blue+calendar), not_interested(red+X), angry(red+warning)

### Permissions Update (`src/lib/permissions.ts`)

- Add `calling: 'calling'` to `PERMISSION_KEYS`
- Add routes to `ROUTE_TO_PERMISSION`
- Add to `PERMISSION_LABELS`, `PERMISSION_GROUPS`, and `DEFAULT_PERMISSIONS` (admin + manager get access)
- Add dynamic route matching for `/calling/*` in `getPermissionForRoute`

## Phase 4: Config Updates

### `supabase/config.toml`

Add entries for the three new edge functions:
```toml
[functions.start-voice-campaign]
verify_jwt = false

[functions.bolna-webhook]
verify_jwt = false

[functions.stop-voice-campaign]
verify_jwt = false
```

## Implementation Sequence

1. Database migration (tables + RLS + realtime + function)
2. Request Bolna secrets from user (`BOLNA_API_KEY`, `BOLNA_AGENT_ID`, `BOLNA_WEBHOOK_SECRET`)
3. TypeScript types
4. Permissions updates
5. Edge functions (start, webhook, stop)
6. Frontend hooks
7. Frontend pages + components
8. Sidebar + routing changes
9. Deploy edge functions + test

## Notes

- Cost displayed in INR with 2 decimal places
- Phone masking: show first 5 + *** + last 2 digits
- CSV validation: 10-digit Indian numbers, auto-prepend +91, remove duplicates
- The `bolna-webhook` uses service role key since it's server-to-server (no user auth)
- Campaign counter updates are atomic via the `increment_campaign_counter` DB function
- Real-time indicator: green pulsing dot next to "In Progress" campaigns

