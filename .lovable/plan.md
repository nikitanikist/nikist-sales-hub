

# Fix: Workshop Linked to Disconnected WhatsApp Session

## Root Cause

The workshop "Crypto Wealth Masterclass (23RD February)" is linked to WhatsApp session `857bbdfb`, which is **dead on the VPS** (returns 404 "Session not found"). The 3 connected sessions you see on the Settings page are different sessions. When Send Now or the automated scheduler tries to send via the dead session, the VPS returns 503 and the message fails.

The dashboard previously showed these as "Sent" because the old VPS returned HTTP 200 even on failure -- that was fixed by your VPS developer. Now it correctly shows "Failed" for the 6:00 PM message, but the earlier 1:00 PM and 4:00 PM were sent before the fix.

## Plan

### 1. Immediate Data Fix -- Reassign workshop to a working session

Update the workshop record to point to one of the 3 connected sessions. Need to know which phone number should be used:
- `07e810ce` (phone: 919717817488)
- `2d70b0ef` (phone: 971501785078)
- `fd5cd67a` (phone: 919818861043)

Will update the workshop's `whatsapp_session_id` to the correct connected session.

### 2. Show Warning in Workshop Detail Sheet When Linked Session is Disconnected

In the Workshop Detail Sheet, check if the linked session's status is `connected`. If not, show a warning banner:
- "The linked WhatsApp session is disconnected. Please select a different session to send messages."
- Disable the Send Now button and messaging actions when the session is disconnected.

### 3. Validate Session Before Sending (Send Now)

Before calling the VPS proxy in `sendMessageNow`, check the session status in the DB. If it's not `connected`, throw a clear error instead of attempting to send and getting a cryptic edge function error.

### 4. Auto-select Working Session in Workshop Detail Sheet

When the linked session is disconnected but other connected sessions exist in the organization, auto-suggest or allow quick switching to a working session directly from the workshop detail sheet.

## Technical Details

### Files to modify:
- `src/hooks/useWorkshopNotification.ts` -- add session status validation before send
- `src/components/operations/WorkshopDetailSheet.tsx` -- show disconnected session warning, disable send actions, allow re-selection
- `src/components/operations/MessagingActions.tsx` -- disable buttons when session is disconnected

### Database update (one-time fix):
```sql
UPDATE workshops 
SET whatsapp_session_id = '<correct_connected_session_id>'
WHERE id = '47e38f71-42f9-4f44-9a8c-c62e70b5e74a';
```

### Session validation in sendMessageNow:
```typescript
// Before sending, verify session is connected
const { data: sessionCheck } = await supabase
  .from('whatsapp_sessions')
  .select('status')
  .eq('id', sessionId)
  .single();

if (sessionCheck?.status !== 'connected') {
  throw new Error('WhatsApp session is disconnected. Please select a different session.');
}
```

### Workshop Detail Sheet warning:
- Query the session status alongside workshop data
- Show an alert banner when status is not "connected"
- Disable Send Now and Run Sequence buttons
- Show a dropdown to quickly switch to a connected session
