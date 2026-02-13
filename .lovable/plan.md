

# Fix: Call Reminder Timeline Not Showing

## Root Cause

The `call_phone_reminders` table has **0 records**. The backfill was never actually executed in any migration. The trigger only fires on changes to `scheduled_date`, `scheduled_time`, or `closer_id` columns specifically -- so the previous attempt (if any) using `updated_at = now()` would not have triggered it.

## Fix

Run a single database migration that performs the backfill by updating `scheduled_date = scheduled_date` on all of Adesh's appointments. This is a no-op value change but it matches the trigger's column list, so it will fire `generate_call_phone_reminders()` for each row and populate the `call_phone_reminders` table.

### Database Migration (single SQL statement)

```sql
UPDATE call_appointments
SET scheduled_date = scheduled_date
WHERE closer_id = 'e2e0ebc6-f203-494c-b52f-bf8d4a6ab69c';
```

This will:
- Fire the trigger for every appointment assigned to Adesh
- Generate `call_phone_reminders` records based on the 3 configured reminder types (1 Day Before at 18:00, Same Day at 10:45, Minutes Before at 5)
- Past reminders will automatically get status = 'skipped', future ones = 'pending'

## No Code Changes Required

The `CallPhoneReminderTimeline` component is already correctly placed in the expanded row (line 1216 of `CloserAssignedCalls.tsx`). It currently returns `null` because `reminders.length === 0`. Once the backfill populates the data, the timeline will appear.

## What Will NOT Change

- No UI code changes
- No trigger function changes
- Existing WhatsApp Reminder Timeline untouched
- All other features untouched
