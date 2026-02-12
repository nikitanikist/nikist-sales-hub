

# Fix Foreign Key Constraint on call_appointments.batch_id

## Root Cause

The `call_appointments` table has a foreign key constraint `call_appointments_batch_id_fkey` that references the **old `batches` table**. After updating the dropdown to use `cohort_batches`, the selected batch ID (e.g., Batch 4 from `cohort_batches`) does not exist in the old `batches` table, causing the constraint violation error.

## What Will Change

### Database Migration

A single migration to:
1. **Drop** the existing foreign key `call_appointments_batch_id_fkey` (pointing to `batches`)
2. **Add** a new foreign key `call_appointments_batch_id_fkey` pointing to `cohort_batches(id)`

This is safe because:
- Existing batch IDs (Batch 1, 2, 3) already exist in **both** `batches` and `cohort_batches` tables (they were migrated during the unified cohort system setup)
- New batches (Batch 4+) only exist in `cohort_batches`
- No other code or pages will be affected -- only this constraint changes

### No Code Changes

The UI code from the previous edit already correctly queries `cohort_batches` and passes the right IDs. Only the database constraint needs updating.

## What Will NOT Be Touched

- No frontend code changes
- No edge function changes
- No other tables or constraints
- AISensy integration remains untouched
- All other pages continue working as before

