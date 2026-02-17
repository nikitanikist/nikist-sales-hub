

# Update Call Status Dropdown: Add "No Show", Remove Legacy Statuses

## Summary

Clean up the call status dropdowns by removing three legacy options (Not Decided, So-So, Pending) and adding **No Show**. Historical records with old statuses will still display correctly.

## Step 1: Database Migration

Add `no_show` to the `call_status` enum so it can be stored in the database. The legacy values stay in the enum to preserve historical data.

```sql
ALTER TYPE public.call_status ADD VALUE IF NOT EXISTS 'no_show';
```

## Step 2: Update UI in Two Files

### `src/pages/CloserAssignedCalls.tsx`

1. Add `no_show` entry to `statusColors` map (red styling, like not_converted)
2. Add `no_show: "No Show"` to `statusLabels` map
3. **Filter dropdown** (~line 928-934): Remove `not_decided`, `so_so`, `pending` SelectItems; add `no_show`
4. **Edit status dropdown** (~line 1252-1258): Same removal and addition

### `src/pages/AllCloserCalls.tsx`

1. Add `no_show` entry to `statusColors` map
2. Add `no_show: "No Show"` to `statusLabels` map
3. **Filter dropdown** (~line 667-673): Remove `not_decided`, `so_so`, `pending` SelectItems; add `no_show`
4. **Edit status dropdown** (~line 892-898): Same removal and addition

## What Does NOT Change

- Legacy values (`not_decided`, `so_so`, `pending`) stay in the color/label maps so old records still render with correct colors and labels
- No other pages, edge functions, or webhook payloads are affected
- The `call_time` field added earlier remains in place

## Final Dropdown Order

After the update, the status dropdowns will show:
- Scheduled
- Converted
- Booking Amount
- Not Converted
- No Show (new)
- Reschedule
- Refunded

