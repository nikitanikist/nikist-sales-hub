

# Fix Call Reminder Timeline — Corrected Approach

## Problem Summary

Two issues need fixing:

1. **Config UI**: The "Value" field is free-text and confusing. Users entered "6:00pm", "10:45Am", "5 minutes before" — the trigger expects "18:00" or "5". The fix: replace with proper input controls (time picker for day_before/same_day, number input for minutes_before) with smart defaults so the value auto-fills when a type is selected.

2. **No reminders generated**: The `call_phone_reminders` table is empty (0 records). The trigger only fires on appointment INSERT/UPDATE, and since the reminder types were added after existing appointments, no reminders exist yet. Need a one-time backfill, plus fix the malformed data.

3. **Timeline UX**: When clicking a reminder card, instead of directly toggling, show a small dialog with "Done" / "Not Done" options. If "Not Done" is selected, show a mandatory text box for the reason. This is purely a UI action — nothing is sent to anyone.

## Changes

### 1. Fix Config UI (AISensySettings.tsx)

Replace the free-text "Value" input:
- **Day Before**: Show hour:minute dropdown (default 18:00). Label changes to "Time".
- **Same Day**: Show hour:minute dropdown (default 10:00). Label changes to "Time".
- **Minutes Before**: Show number input (default 5). Label changes to "Minutes".
- When user selects a type, the value auto-fills with the default.
- Remove the old placeholder-based free-text input.

### 2. Fix Malformed Data

Update the 3 existing records in `call_phone_reminder_types`:
- "6:00pm" to "18:00"
- "10:45Am" to "10:45"
- "5 minutes before" to "5"

### 3. Backfill Existing Appointments

Run an UPDATE on Adesh's existing appointments to re-trigger the `generate_call_phone_reminders` function. Since the trigger fires on UPDATE of `scheduled_date`, `scheduled_time`, or `closer_id`, we can update `scheduled_date = scheduled_date` (no-op) to trigger it. This will populate `call_phone_reminders` for all existing appointments.

### 4. Update Timeline Component (CallPhoneReminderTimeline.tsx)

Replace the direct toggle behavior with a dialog popup:
- Clicking a reminder card opens a small dialog
- Dialog shows two options: "Done" and "Not Done"
- If "Done" is selected: mark status as 'done', record timestamp and user, close dialog
- If "Not Done" is selected: show a mandatory textarea for the reason. The reason gets saved (add a `skip_reason` column to `call_phone_reminders`). Mark status as 'skipped'.
- Show a small X icon on completed/skipped reminders (like WhatsApp timeline)
- Display the reminder time on each card

### 5. Database Migration

Add a `skip_reason` column to `call_phone_reminders` for storing the "Not Done" reason:
```
ALTER TABLE call_phone_reminders ADD COLUMN skip_reason TEXT;
```

## What Will NOT Change

- Existing WhatsApp Reminder Timeline — completely untouched
- AISensy template configuration — untouched
- REMINDER_TYPES constant — untouched
- All edge functions — untouched
- No existing features renamed or moved

## Technical Details

### Files to Edit
- `src/pages/settings/AISensySettings.tsx` — Replace Value input with time picker / number input, auto-defaults
- `src/components/CallPhoneReminderTimeline.tsx` — Add dialog popup with Done/Not Done flow, mandatory reason for Not Done

### Database Changes
- Add `skip_reason TEXT` column to `call_phone_reminders`
- Fix 3 malformed records in `call_phone_reminder_types`
- Backfill: trigger reminders for Adesh's existing appointments
