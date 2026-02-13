

# Call Reminder Timeline — Inside Closer Notification Config

## Summary

Add a **"Call Reminders"** section inside each closer's notification configuration card (in the AISensy settings page), right below the existing "Template Names per Reminder Type" section. This section will allow admins to define custom call reminder checkpoints (e.g., "Day Before 6 PM", "Same Day Morning", "Before Call 7 min") with an **"Add Reminder"** button for adding more. These configured reminders will then appear dynamically in the expanded row of the Sales Closers list as a **"Call Reminder Timeline"** below the existing WhatsApp Reminder Timeline.

## What Will Change

### 1. Database: New tables for call reminders

**`call_phone_reminder_types`** — Stores the configurable reminder definitions per closer:
- `id`, `organization_id`, `closer_id`
- `label` (text, e.g., "Day Before Evening")
- `offset_type` (text: 'day_before', 'same_day', 'minutes_before')
- `offset_value` (text, e.g., '18:00' for day-before time, '10:00' for morning, or '7' for minutes)
- `display_order` (integer)
- `is_active` (boolean)
- `created_at`, `updated_at`

**`call_phone_reminders`** — Stores per-appointment reminder instances:
- `id`, `appointment_id`, `reminder_type_id` (FK to above)
- `reminder_time` (timestamptz)
- `status` (text: 'pending', 'done', 'skipped')
- `completed_at`, `completed_by`
- `organization_id`, `created_at`

**Database trigger**: When an appointment is created/updated, auto-generate records in `call_phone_reminders` based on the closer's configured reminder types.

### 2. UI: Add "Call Reminders" section in each closer's config card

In `src/pages/settings/AISensySettings.tsx`, inside the `CloserNotificationCard` component, add a new section after the template names:

- A heading: **"Call Reminders"**
- A list of configured call reminders showing label and timing
- Each row has a delete button
- An **"Add Reminder"** button at the bottom to add new entries
- When adding: select offset type (Day Before / Same Day / Minutes Before) and set the time/minutes value

This data is saved alongside the closer's notification config when clicking "Save Configuration".

### 3. UI: Show "Call Reminder Timeline" in expanded rows

In `src/pages/CloserAssignedCalls.tsx` and `src/pages/AllCloserCalls.tsx`, below the existing "Reminder Timeline" section, add a new **"Call Reminder Timeline"** section:

- Shows the dynamically configured checkpoints (from the closer's config)
- Each checkpoint is clickable to mark as "done" (records who completed it and when)
- Color coding: green = done, yellow = pending, gray = skipped
- If no call reminders are configured for that closer, the section is hidden

### 4. RLS Policies

- `call_phone_reminder_types`: admin/manager can manage; sales_rep can view their own closer_id records
- `call_phone_reminders`: admin/manager can manage; sales_rep can view/update for their own appointments

## What Will NOT Change

- Existing WhatsApp Reminder Timeline (the `call_reminders` table and `calculate_reminder_times` trigger) — completely untouched
- AISensy account management and template configuration — untouched
- The `REMINDER_TYPES` constant and all WhatsApp notification logic — untouched
- All edge functions — untouched
- No existing features are renamed or moved

## Technical Details

### Files to Create
- Migration SQL for `call_phone_reminder_types`, `call_phone_reminders` tables, trigger, and RLS policies

### Files to Edit
- `src/pages/settings/AISensySettings.tsx` — Add "Call Reminders" section inside `CloserNotificationCard`, with add/delete UI for reminder types
- `src/pages/CloserAssignedCalls.tsx` — Add "Call Reminder Timeline" section below existing Reminder Timeline in expanded rows, with clickable status toggles
- `src/pages/AllCloserCalls.tsx` — Same Call Reminder Timeline addition for admin view
