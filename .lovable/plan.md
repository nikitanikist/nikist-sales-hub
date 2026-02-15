

# Fix: Campaign Scheduling Timezone Issue

## Root Cause

The `datetime-local` HTML input produces a bare string like `"2025-02-15T02:28"` with **no timezone information**. This string is stored directly in the `scheduled_for` column. Two problems result:

1. **Storage**: The raw string is saved without converting to UTC. The database and the edge function (`process-notification-campaigns`) compare it against `new Date().toISOString()` (which is UTC), causing a mismatch. A campaign scheduled for 2:28 AM IST gets treated as 2:28 AM UTC (which is 7:58 AM IST).

2. **Display**: The Campaigns and Scheduled Messages pages use `format(new Date(...), "MMM d, yyyy h:mm a")` which renders in the browser's local timezone -- inconsistent with the organization's configured timezone.

## Solution

### 1. Fix storage (SendNotification.tsx)

When the user picks a datetime, treat it as the **organization's timezone** and convert to a proper UTC ISO string before saving. This uses the existing `fromOrgTime` utility from `timezoneUtils.ts` and the org timezone from `useOrgTimezone`.

- Import `useOrgTimezone` and `fromOrgTime`
- In `handleSubmit`, convert `scheduledFor` to UTC:
  ```
  const scheduledDate = new Date(scheduledFor);  // browser parses as local
  const utcDate = fromOrgTime(scheduledDate, orgTimezone);
  scheduled_for: sendMode === "schedule" ? utcDate.toISOString() : null
  ```
- In the Step 4 confirmation display, show the time in org timezone using `formatInOrgTime`

### 2. Fix display (Campaigns.tsx, ScheduledMessages.tsx, CampaignDetail.tsx)

Replace all `format(new Date(c.scheduled_for), ...)` and `format(new Date(c.created_at), ...)` calls with `formatInOrgTime(c.scheduled_for, orgTimezone, "MMM d, yyyy h:mm a")` so times are always shown in the organization's timezone.

- Import `useOrgTimezone` and `formatInOrgTime` in each page
- Update all date formatting calls

## Files Modified

| File | Change |
|------|--------|
| `SendNotification.tsx` | Import timezone utils, convert `scheduledFor` to UTC before insert, fix confirmation display |
| `Campaigns.tsx` | Import timezone utils, format `scheduled_for` and `created_at` with org timezone |
| `ScheduledMessages.tsx` | Import timezone utils, format `scheduled_for` with org timezone |
| `CampaignDetail.tsx` | Import timezone utils, format `sent_at` with org timezone |

No database changes needed. The edge function already correctly compares against UTC -- the fix is ensuring we store proper UTC values.
