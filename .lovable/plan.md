

# Fix "Could not find relationship" Error

## Root Cause

After the migration changed the foreign key from `batches` to `cohort_batches`, two queries in `CloserAssignedCalls.tsx` still use the old join syntax `batch:batches(id, name, start_date)`. PostgREST looks for a relationship to `batches` but the FK now points to `cohort_batches`, causing the error.

## Changes

### File: `src/pages/CloserAssignedCalls.tsx`

**1. Line 455** - Update the appointment fetch query join:
- Change `batch:batches(id, name, start_date)` to `batch:cohort_batches(id, name)`
- Remove `start_date` since `cohort_batches` doesn't have that column in the same way

**2. Line 612** - Update the post-save refetch query join:
- Same change: `batch:batches(id, name, start_date)` to `batch:cohort_batches(id, name)`

**3. Lines 480-490 and 627-637** - Remove the fallback cohort_batches lookups:
- These were added as workarounds for when the old `batches` join returned null. Now that the FK directly references `cohort_batches`, the join will always work and these fallbacks are unnecessary.

**4. Line 55** - Update the type definition:
- Remove `start_date` from the batch type since we're now using `cohort_batches`

## What Will NOT Change

- No database changes needed (migration is already done)
- No other files affected
- Conversion sync logic stays the same
- AISensy/notification logic untouched
