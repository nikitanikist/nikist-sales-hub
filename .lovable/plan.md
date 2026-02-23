

# Fix WhatsApp Session Status Sync and Error Tracking

## Problem

Messages are marked as "Sent" in the dashboard even when WhatsApp delivery fails silently. The VPS developer has already fixed the `/send` endpoint to return HTTP 503 on disconnected sessions. Now the CRM needs three fixes.

## Changes

### 1. Database Migration -- Add error tracking columns

- `whatsapp_sessions`: add `last_error` (text) and `last_error_at` (timestamptz)
- `scheduled_whatsapp_messages`: add `vps_error` (text)

### 2. Session Verification on Page Load (`src/hooks/useWhatsAppSession.ts`)

Add a `verifySession` function that calls the VPS `status` action for each "connected" session when the sessions list loads. If VPS reports the session is not actually connected:
- Update the database status to match reality
- Store the error in `last_error` / `last_error_at`
- Invalidate the query cache so the UI reflects the real state

This runs once when the WhatsApp settings page loads (via a `useEffect` on the `sessions` data).

### 3. Show Real Status in Dashboard (`src/pages/settings/WhatsAppConnection.tsx`)

Update the connected sessions list to show verification state:
- While verifying: show a "Verifying..." badge with a spinner
- If VPS confirms connected: show green "Connected" badge (as today)
- If VPS reports disconnected: show red "Disconnected -- Reconnect needed" badge
- If session has a `last_error`: show the error text below the session info

### 4. Edge Function: Store VPS errors on send failure (`supabase/functions/process-whatsapp-queue/index.ts`)

When the VPS `/send` call fails (now returning 503), store the error response in the `vps_error` column of `scheduled_whatsapp_messages` alongside the existing `error_message`. This gives operators visibility into why a specific message failed.

## Technical Details

### Database Migration (SQL)

```sql
ALTER TABLE whatsapp_sessions 
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz;

ALTER TABLE scheduled_whatsapp_messages 
  ADD COLUMN IF NOT EXISTS vps_error text;
```

### Hook Changes (`useWhatsAppSession.ts`)

- Add `verifyingSessionIds` state (Set) to track which sessions are being verified
- Add `verifiedStatuses` state (Map of sessionId to VPS status)
- Add `useEffect` that fires when `sessions` data loads: for each connected session, call `callVPSProxy('status', { sessionId })` and compare result
- If mismatch, update DB via `supabase.from('whatsapp_sessions').update(...)` and invalidate query
- Export `verifyingSessionIds` and `verifiedStatuses` for the UI

### UI Changes (`WhatsAppConnection.tsx`)

- Replace the static green dot with a dynamic badge:
  - Verifying: amber "Verifying..." with spinner
  - Verified connected: green dot (unchanged)
  - Verified disconnected: red dot + "Disconnected" badge + error text
- Show `last_error` text when present

### Edge Function Changes (`process-whatsapp-queue/index.ts`)

- In the error handler (line ~194), add `vps_error` field to the update:
```typescript
.update({
  status: isFinalFailure ? 'failed' : 'pending',
  retry_count: retryCount,
  error_message: errorMessage,
  vps_error: errorMessage,  // NEW
})
```

## Files Modified

- **New migration**: SQL to add 3 columns
- `src/hooks/useWhatsAppSession.ts` -- session verification logic
- `src/pages/settings/WhatsAppConnection.tsx` -- real status display
- `supabase/functions/process-whatsapp-queue/index.ts` -- store VPS error on failure
