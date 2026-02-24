

# Fix: Sessions Stuck in "Connecting" When Actually Connected

## Problem

The session `a545e2c1-...` is actually connected on the VPS, but the database still shows `connecting`. This happens because:

1. The page-load verification only checks sessions with `status = 'connected'` -- it skips `connecting` sessions entirely
2. The new webhook hasn't been triggered by the VPS for this session yet
3. The polling only runs during an active connection attempt (when the user clicks "Connect"), not for sessions already in the history list

## Solution

Expand the page-load verification to also check `connecting` sessions against the VPS. If the VPS reports `connected`, update the DB accordingly and trigger auto-migration.

### Changes

#### 1. `src/hooks/useWhatsAppSession.ts` -- Verify `connecting` sessions too

Update the verification filter (line 467-468) from:

```typescript
const connectedToVerify = sessions.filter(
  s => s.status === 'connected' && !verifiedRef.current.has(s.id)
);
```

To:

```typescript
const connectedToVerify = sessions.filter(
  s => (s.status === 'connected' || s.status === 'connecting') && !verifiedRef.current.has(s.id)
);
```

Also update the stale-session handler (line 488) to handle the case where VPS reports `connected` for a `connecting` session -- update the DB to `connected` and set phone number:

```typescript
if (vpsStatus === 'connected') {
  // Session is connected on VPS but DB might not know yet
  if (session.status !== 'connected') {
    await supabase
      .from('whatsapp_sessions')
      .update({
        status: 'connected',
        phone_number: data?.phoneNumber || session.phone_number,
        connected_at: new Date().toISOString(),
      })
      .eq('id', session.id);
    queryClient.invalidateQueries({ queryKey: ['whatsapp-sessions'] });
  }
} else {
  // existing stale-session logic...
}
```

#### 2. `src/pages/settings/WhatsAppConnection.tsx` -- Add refresh button to session history

Add a small refresh/retry button next to each session in the history list so the user can manually trigger a status recheck without reloading the entire page.

## Result

- On page load, `connecting` sessions are verified against the VPS
- If VPS says `connected`, the DB is updated immediately and the session moves from "Session History" to the active sessions list
- A manual refresh button provides an escape hatch for any stuck state

