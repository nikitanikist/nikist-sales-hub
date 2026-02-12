

# Fix Student Sync to Cohort Batches

## What Went Wrong

When Keyur's appointment was marked as "converted" with Batch 4 assigned, the student record was never created in the batch's student list. Two issues caused this:

1. **Batch 4 has no start date set** -- the code crashes with "Batch start date is required" at Step 4 (Pabbly webhook), making the entire save appear to fail. Although the appointment status did save (Step 1), the student sync (Step 3) either failed silently or was affected by the error flow.

2. **No error feedback on student sync** -- when the insert into the student list fails for any reason, the error is completely swallowed with no feedback shown.

3. **Closers cannot sync students** -- the student list table only allows admin and manager roles to insert AND view records. When a closer (like Dipanshu) converts someone, the sync silently fails. The closer also cannot view the cohort batch students page since SELECT is restricted too.

## What Will Change

### 1. Database: Update security policies for closers

Update the `cohort_students` table policies:
- **INSERT policy**: Add `sales_rep` role so closers can sync converted students
- **SELECT policy**: Add `sales_rep` role but with a filter -- closers can only see students where `closer_id` matches their own user ID

This matches what you described: closers only see students they personally converted.

### 2. Database: Insert Keyur's missing record

One-time fix to add Keyur to Batch 4 with the correct data from his appointment:
- Batch 4 (ecd65889...)
- Offer: 15,000 | Cash received: 2,000 | Due: 13,000
- Classes access: 3
- Closer: Dipanshu

### 3. Code: Fix the start_date crash

In `CloserAssignedCalls.tsx`, line 684:
- Remove the hard error when batch start_date is missing
- Send the Pabbly webhook with start_date as empty when not available
- The webhook can handle missing dates gracefully

### 4. Code: Add error handling on student sync

In `CloserAssignedCalls.tsx`, lines 647-661:
- Check for errors after the insert/update calls
- Log errors and show a warning toast so issues are visible instead of silent

## What Will NOT Change

- No changes to any other pages
- No changes to notifications or AISensy logic  
- No changes to the Pabbly edge function
- Closer permissions for other menu items stay the same
- Admin/manager access stays unchanged

## Technical Details

### Files to Edit
- `src/pages/CloserAssignedCalls.tsx` -- fix start_date validation + add error handling

### Database Changes
- Update INSERT policy on `cohort_students`: add `sales_rep` role
- Update SELECT policy on `cohort_students`: add `sales_rep` with `closer_id = auth.uid()` filter
- Insert missing record for Keyur into `cohort_students`

