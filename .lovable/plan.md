

# Update Call Status Dropdowns — Implementation Plan

## Current State
The dropdowns still show the old statuses: Not Decided, So-So, and Pending. No changes have been made yet — the previous plan was approved but the database update was not confirmed, so implementation did not proceed.

## What Needs to Happen

### 1. Database Update
Add the `no_show` value to the call_status enum in the database. This is required before the UI can use it.

```sql
ALTER TYPE public.call_status ADD VALUE IF NOT EXISTS 'no_show';
NOTIFY pgrst, 'reload schema';
```

### 2. UI Updates in `src/pages/CloserAssignedCalls.tsx`

- Add `no_show` to `statusColors` map (red styling)
- Add `no_show: "No Show"` to `statusLabels` map
- **Filter dropdown** (lines 928-934): Remove the three `SelectItem` entries for `not_decided`, `so_so`, `pending`; add one for `no_show`
- **Edit status dropdown** (lines 1252-1258): Same removal and addition

### 3. UI Updates in `src/pages/AllCloserCalls.tsx`

- Add `no_show` to `statusColors` map (red styling)
- Add `no_show: "No Show"` to `statusLabels` map
- **Filter dropdown** (lines 667-672): Remove `not_decided`, `so_so`, `pending`; add `no_show`
- **Edit status dropdown** (lines 892-897): Same removal and addition

## What Stays the Same
- Legacy keys (`not_decided`, `so_so`, `pending`) remain in the `statusColors` and `statusLabels` maps so any historical records with those statuses still display with correct colors and labels
- No other pages, edge functions, or webhook payloads are affected

## Final Dropdown Order
- Scheduled
- Converted
- Booking Amount
- Not Converted
- No Show (new)
- Reschedule
- Refunded

