

# Fix: False WhatsApp Disconnection Warning

## Root Cause

The `WhatsAppDashboard.tsx` filters sessions by `status === "disconnected"` and shows a warning banner whenever any disconnected session exists. In the `onepercentclub` organization, there is a stale session (`03c4c798`) with `status: disconnected` and `phone_number: null` -- it never completed pairing. This orphan record triggers the red banner even though both real WhatsApp numbers (918655409193 and 916290859215) are fully connected.

## Fix

Update the `disconnectedSessions` filter in `WhatsAppDashboard.tsx` (line 28-30) to only include sessions that actually had a phone number. Sessions without a phone number are stale QR attempts that never completed and should not trigger a warning.

**Current code (line 28-30):**
```typescript
const disconnectedSessions = useMemo(
  () => sessions?.filter((s) => s.status === "disconnected") || [],
  [sessions]
);
```

**Fixed code:**
```typescript
const disconnectedSessions = useMemo(
  () => sessions?.filter((s) => s.status === "disconnected" && s.phone_number) || [],
  [sessions]
);
```

This single-line change ensures only sessions that were previously working (had a phone number) can trigger the disconnection warning. Stale/abandoned pairing attempts are silently ignored.

## Files to Modify

- `src/pages/whatsapp/WhatsAppDashboard.tsx` -- add `&& s.phone_number` to the disconnectedSessions filter (line 29)

## Optional Cleanup

Consider also cleaning up the stale database records (the `qr_pending` and phone-less `disconnected` sessions) from the `onepercentclub` organization, but this is not required for the fix.
