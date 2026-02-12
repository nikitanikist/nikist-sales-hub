

# Fix Batch Dropdown to Show Only Insider Crypto Club Batches

## Problem

The closer conversion dropdown at line 388-403 of `CloserAssignedCalls.tsx` queries the old `batches` table which only has Batch 1, 2, 3. Batch 4 and any future batches exist in the `cohort_batches` table under the "Insider Crypto Club" cohort type.

## Reminder Confirmation

The `process-due-reminders` function (lines 100-108) already handles this correctly:

```text
If reminderDateTime < appointmentCreatedAt --> mark as "skipped"
```

So for a call booked at 10:30 PM on Feb 12, reminder times like "24 hours before" (10:30 PM Feb 11) are in the past relative to booking time and get skipped automatically. Only upcoming reminder times will fire.

## What Will Change

### File: `src/pages/CloserAssignedCalls.tsx`

**1. Update the batch query (lines 388-403)**

Change from:
- Query `batches` table

Change to:
- Query `cohort_batches` table
- Filter by `cohort_type_id` matching the "Insider Crypto Club" cohort type (slug: `insider-crypto-club`)
- Join with `cohort_types` to get the cohort type name
- Filter only `is_active = true`
- Sort by `created_at` descending (newest batch first: Batch 4, 3, 2, 1)

The query will look up the cohort type dynamically using the organization's cohort types, filtering to only show "Insider Crypto Club" batches since that is the cohort type relevant to sales conversions. Future Mentorship and High Future batches are managed separately and should not appear here.

**2. Update the dropdown display (around line 1275)**

Show batch name only (e.g., "Batch 4", "Batch 3") since they all belong to the same cohort type. Newest batch appears first.

**3. Update the batch name display on appointment rows**

Where the current batch name badge is shown, ensure it resolves from `cohort_batches` instead of the old `batches` table.

## What Will NOT Be Touched

- AISensy integration (just completed)
- Notification edge functions
- Any other pages or components
- The conversion-to-cohort sync logic (already works with `cohort_batches`)

