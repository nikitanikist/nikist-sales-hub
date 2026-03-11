

# Add Closer Selection to All "Add Student" Dialogs

## Problem
The "Add Student" dialogs across all cohort types (Cohort, Futures, High Future) do not include a Closer dropdown, but the "Update EMI" dialogs do. The user wants closers (users with `sales_rep` role) to be selectable when initially adding a student.

## Changes

### 1. `src/components/AddCohortStudentDialog.tsx`
- Import `useOrgClosers` hook and `Select` components
- Add `closerId` state variable
- Add a Closer dropdown in the form (between Conversion Date/Batch row and Offer Amount row)
- Populate it with closers from `useOrgClosers()` (which already filters to `sales_rep` and `admin` roles)
- Pass `closer_id: closerId || null` in the `cohort_students` insert

### 2. `src/components/AddFuturesStudentDialog.tsx`
- Same changes as above: import hook, add state, add dropdown, pass `closer_id` on insert

### 3. `src/components/AddHighFutureStudentDialog.tsx`
- Same changes as above: import hook, add state, add dropdown, pass `closer_id` on insert

All three dialogs follow the same pattern. The `useOrgClosers` hook already exists and fetches organization-scoped users with `sales_rep` or `admin` roles — this is the same data source used in the Update EMI dialogs.

