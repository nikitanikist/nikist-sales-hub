

# Update Call Status Dropdowns: Add "No Show", Remove Legacy Statuses

## Summary

Remove three legacy status options (Not Decided, So-So, Pending) from the selection dropdowns and add **No Show**. Historical records with old statuses will still display correctly since we keep them in the color/label maps.

## Step 1: Database Migration

Add `no_show` to the `call_status` enum so the database accepts the new value. The three legacy values stay in the enum so existing data isn't broken.

```sql
ALTER TYPE public.call_status ADD VALUE IF NOT EXISTS 'no_show';
NOTIFY pgrst, 'reload schema';
```

## Step 2: Update `src/pages/CloserAssignedCalls.tsx`

**a) statusColors map (line 113):** Add `no_show` entry with red styling before the closing brace.

**b) statusLabels map (line 129):** Add `no_show: "No Show"` entry before the closing brace.

**c) Filter dropdown (lines 930-933):** Remove the three `SelectItem` entries for `not_decided`, `so_so`, and `pending`. Add one new entry for `no_show`.

**d) Edit status dropdown (lines 1254-1257):** Remove the three `SelectItem` entries for `not_decided`, `so_so`, and `pending`. Add one new entry for `no_show`.

## Step 3: Update `src/pages/AllCloserCalls.tsx`

Same four changes:

**a) statusColors map (line 113):** Add `no_show` entry with red styling.

**b) statusLabels map (line 129):** Add `no_show: "No Show"`.

**c) Filter dropdown (lines 669-672):** Remove `not_decided`, `so_so`, `pending` SelectItems. Add `no_show`.

**d) Edit status dropdown (lines 894-897):** Remove `not_decided`, `so_so`, `pending` SelectItems. Add `no_show`.

## What Does NOT Change

- Legacy values (`not_decided`, `so_so`, `pending`) remain in `statusColors` and `statusLabels` maps so historical records display with correct colors and labels
- No other pages, edge functions, or webhooks are affected

## Final Dropdown Order

- Scheduled
- Converted (and variants)
- Booking Amount
- Not Converted
- No Show (new)
- Reschedule
- Refunded

