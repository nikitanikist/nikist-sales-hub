

# Fix: Campaign Cache Invalidation + Realtime Status Updates

## Two Issues

1. **After creating a campaign**, navigating to the Campaigns page shows stale data (new campaign missing) because React Query cache isn't invalidated.
2. **Campaign status changes** (e.g., Scheduled to Completed) done by the background edge function are not reflected until manual refresh, because there's no realtime subscription.

## Solution

### 1. Cache Invalidation on Campaign Creation (`SendNotification.tsx`)

- Import `useQueryClient` from `@tanstack/react-query`
- Before `navigate("/whatsapp/campaigns")` (line 252), invalidate the campaign queries:
  ```
  queryClient.invalidateQueries({ queryKey: ["notification-campaigns"] });
  queryClient.invalidateQueries({ queryKey: ["scheduled-campaigns"] });
  ```

### 2. Realtime Subscription on Campaigns Page (`Campaigns.tsx`)

- Add a Supabase Realtime subscription on the `notification_campaigns` table filtered by the current organization
- On any `UPDATE` event, invalidate the `notification-campaigns` query so the table auto-refreshes when the edge function changes a campaign's status
- Clean up the subscription on unmount

### 3. Enable Realtime (Database Migration)

- Run: `ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_campaigns;`

## Files Modified

| File | Change |
|------|--------|
| `SendNotification.tsx` | Add `useQueryClient`, invalidate cache before navigate |
| `Campaigns.tsx` | Add `useEffect` with Supabase realtime channel subscription to auto-invalidate on status changes |
| Database migration | Enable realtime on `notification_campaigns` table |

