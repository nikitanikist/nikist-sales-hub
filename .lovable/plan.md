
# Fix: Update Database Status After WhatsApp Disconnect

## Problem Identified

When you click "Disconnect", the edge function successfully calls the VPS disconnect endpoint, but **it never updates the database status to "disconnected"**. The UI shows "Connected" because:

1. The frontend reads session status from the `whatsapp_sessions` table
2. After disconnect, the database still has `status: 'connected'`
3. The session query returns the stale "connected" status

## Root Cause

In `supabase/functions/vps-whatsapp-proxy/index.ts`, the disconnect action (lines 203-231) only calls the VPS but does not update the database. Compare to the `status` action which has explicit DB update logic (lines 380-416).

## Solution

Add database status update logic after a successful VPS disconnect call, similar to how the `status` action works.

---

## File to Modify

| File | Change |
|------|--------|
| `supabase/functions/vps-whatsapp-proxy/index.ts` | Add DB update after successful disconnect |

---

## Technical Implementation

After the VPS response is received (around line 349), add a new block to handle the `disconnect` action:

```typescript
// Update session status after successful disconnect
if (action === 'disconnect' && localSessionIdForDb && organizationId) {
  const { error: updateError } = await supabase
    .from('whatsapp_sessions')
    .update({
      status: 'disconnected',
      phone_number: null,
      qr_code: null,
      qr_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', localSessionIdForDb);

  if (updateError) {
    console.error('Failed to update session status after disconnect:', updateError);
  } else {
    console.log(`Session ${localSessionIdForDb} marked as disconnected`);
  }

  // Return success to frontend
  return new Response(
    JSON.stringify({ 
      success: true, 
      status: 'disconnected',
      sessionId: localSessionIdForDb 
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

This code will:
1. Update the session status to `'disconnected'` in the database
2. Clear the phone number and QR code fields
3. Update the `updated_at` timestamp
4. Return a success response to the frontend

---

## Expected Behavior After Fix

1. User clicks "Disconnect"
2. Edge function calls VPS `POST /disconnect/wa_xxx`
3. VPS returns success
4. **NEW: Edge function updates database status to 'disconnected'**
5. Frontend invalidates queries and refetches
6. UI shows "Not Connected" status
