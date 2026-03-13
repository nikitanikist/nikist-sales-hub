

# Fix: Add Notes to Batch + Ensure Batch Start Date in Pabbly Webhook

## Problem
1. The "Create New Batch" / "Edit Batch" dialogs only save `event_dates` (free text) — the `start_date` column is never populated, so the Pabbly webhook sends an empty `batch_start_date`.
2. There's no "Notes" field on batches for storing extra info (like event schedules for Future Mentorship).

## Changes

### 1. Database migration: Add `notes` column to `cohort_batches`
```sql
ALTER TABLE cohort_batches ADD COLUMN notes text;
```

### 2. Update Create/Edit batch dialogs (`src/pages/CohortPage.tsx`)
- Add `formStartDate` (Date state) and `formNotes` (string state)
- Add a **Date Picker** labeled "Start Date" in both Create and Edit dialogs
- Add a **Textarea** labeled "Notes (optional)" in both dialogs
- Update `createBatchMutation` insert payload to include `start_date` and `notes`
- Update `updateBatchMutation` update payload to include `start_date` and `notes`
- Update `resetForm()` to clear both new fields
- Pre-populate `formStartDate` and `formNotes` when opening edit dialog
- Update `CohortBatch` interface to include `notes`

### 3. Display notes on batch cards (`src/pages/CohortPage.tsx`)
- On batch cards (grid view, lines ~779-785): after the date line, show `batch.notes` in a small colored text (e.g., `text-amber-600`) if present
- On the batch detail header (line ~936-940): show notes below the event dates line

### 4. Webhook fallback (`src/pages/CloserAssignedCalls.tsx`)
- Change the batch join on lines 458 and 601 from `batch:cohort_batches(id, name, start_date)` to `batch:cohort_batches(id, name, start_date, event_dates)`
- Update line 704: `batch_start_date: freshAppointment.batch?.start_date || freshAppointment.batch?.event_dates || ''`
- This only affects Insider Crypto Club batches (the only ones used in the closer flow)

### 5. Backfill existing Nikist batches (data update)
Update the 3 Insider Crypto Club batches that have `event_dates` but null `start_date`:
- Batch 6 → `2026-03-24`
- Batch 5 → `2026-03-11`  
- Batch 4 → `2026-02-16`

## Scope
- Only `CohortPage.tsx` and `CloserAssignedCalls.tsx` are modified
- Manage Cohorts page is **not touched**
- No changes to Future Mentorship, High Future, or any other module
- One small migration to add `notes` column

