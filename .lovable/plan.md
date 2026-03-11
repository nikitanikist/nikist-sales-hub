

# Add Schedule Feature to IVR Campaign Creation

## Overview
Add the ability to schedule IVR campaigns for a future date/time instead of running them immediately. The user picks a date and time in IST, and the campaign auto-starts at that time.

## How It Works

The `ivr_campaigns` table already has `scheduled_at` (timestamp) and supports `status: "scheduled"`. The `start-ivr-campaign` function already accepts scheduled status. The missing pieces are:

1. **UI** — Let users choose between "Run Now" and "Schedule" on Step 3
2. **Auto-start** — Make `process-ivr-queue` check for scheduled campaigns whose time has arrived

## Changes

### 1. `src/pages/ivr/CreateIvrCampaignDialog.tsx`
- Add state: `launchMode` ("now" | "schedule"), `scheduleDate`, `scheduleTime`
- On Step 3, add a radio/toggle: "Run Now" vs "Schedule for Later"
- When "Schedule" is selected, show a date picker and time input (displayed as IST)
- Update `handleCreate`:
  - If "now": create with `status: "draft"` then call `start-ivr-campaign` (current behavior)
  - If "schedule": create with `status: "scheduled"` and `scheduled_at` set to the chosen IST datetime converted to UTC. Do NOT call `start-ivr-campaign`.
- Update review section to show scheduled time when applicable
- Change button label: "Create & Run Now" vs "Schedule Campaign"

### 2. `supabase/functions/process-ivr-queue/index.ts`
- At the start of the outer loop (before querying running campaigns), add a check:
  - Query `ivr_campaigns` where `status = 'scheduled'` and `scheduled_at <= now()`
  - For each matched campaign, update status to `"running"`, set `started_at`, and update all `pending` calls to `queued` (same logic as `start-ivr-campaign`)
  - Log the auto-start event
- This piggybacks on the existing cron trigger (runs every minute), so scheduled campaigns start within ~1 minute of their scheduled time

### 3. `src/pages/ivr/IvrCampaignDetail.tsx`
- Show `scheduled_at` in the campaign header when status is "scheduled", formatted in IST

## Technical Details
- IST conversion: user picks date + time, construct as `Asia/Kolkata` timezone, convert to UTC ISO string for `scheduled_at`
- The date picker uses the Shadcn Calendar component inside a Popover; time is a simple `<Input type="time">`
- No database migration needed — `scheduled_at` column already exists

