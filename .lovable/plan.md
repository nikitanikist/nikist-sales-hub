

# Fix: Real-time Member Count Updates on Webinar Page

## Problem

The `whatsapp_groups` real-time subscription was added to `useWhatsAppGroups.ts`, but the Webinar Notification page uses a different hook (`useWebinarNotification`) with its own query key (`webinar-notifications`). When `participant_count` updates in the `whatsapp_groups` table, the webinar query is never invalidated, so the member count stays stale.

## Solution

Add a Supabase real-time subscription inside `useWebinarNotification` that listens for `UPDATE` events on `whatsapp_groups` (filtered by the current organization) and invalidates the `webinar-notifications` query key.

## Technical Details

### File: `src/hooks/useWebinarNotification.ts`

Inside the `useWebinarNotification` function, add a `useEffect` that:

1. Creates a Supabase channel listening for `postgres_changes` on `whatsapp_groups` (event: `UPDATE`, filter by `organization_id`)
2. On any change, calls `queryClient.invalidateQueries({ queryKey: ['webinar-notifications'] })`
3. Cleans up the channel on unmount

This reuses the same real-time publication already enabled (`supabase_realtime` now includes `whatsapp_groups`). No database changes needed.

