
# Fix: Sessions Stuck in "Connecting" Due to Unique Constraint Conflict

## Problem

When you scan a QR code and WhatsApp connects, the dashboard shows "Connected successfully!" (toast), but the session stays as "connecting" in the Session History. This happens every time you reconnect a phone number that was previously used.

**Root cause**: There is a database rule that says "only one session per organization can have a given phone number." When the new session tries to save the phone number, an old session already has it claimed. The save fails silently, so the new session is never updated to "connected" in the database.

The edge function logs confirm this:
```
Failed to update session status: duplicate key value violates unique constraint 
"whatsapp_sessions_organization_id_phone_number_key"
```

## Solution

Before updating a newly connected session with the phone number, clear the phone number from any old sessions in the same organization. This lets the new session claim the phone number without conflict.

### Changes

#### 1. `supabase/functions/vps-whatsapp-proxy/index.ts` -- Status handler (around line 813)

Before the existing `supabase.update()` call that sets `phone_number`, add a step to nullify the phone number on old sessions:

```typescript
// If this session is now connected with a phone number,
// clear that phone number from any OTHER sessions in the same org
// to avoid the unique constraint violation
if (dbStatus === 'connected' && responseData?.phoneNumber) {
  await supabase
    .from('whatsapp_sessions')
    .update({ phone_number: null })
    .eq('organization_id', organizationId)
    .eq('phone_number', responseData.phoneNumber)
    .neq('id', localSessionIdForDb);
}
```

This goes right before the existing update (line 828) so the constraint is cleared before the new phone number is set.

#### 2. `supabase/functions/whatsapp-status-webhook/index.ts` -- Same fix for webhook path

Apply the same "clear old phone numbers first" logic in the webhook handler, so that when the VPS triggers the webhook directly, the same constraint issue doesn't block the update.

#### 3. Clean up existing stuck data

Run a one-time cleanup to fix the currently stuck sessions:
- Null out phone numbers on old `connecting` sessions that are blocking new ones
- This will allow the refresh button (already built) to resolve the stuck sessions

## Result

- Reconnecting a phone number that was previously used will work without getting stuck
- The "Connected successfully" toast will match reality -- the DB will actually be updated
- Old sessions won't block new ones from claiming their phone number
