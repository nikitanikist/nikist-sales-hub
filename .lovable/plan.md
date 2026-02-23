

# Fix: Scheduled Messages Using Dead Session via Stale Group Link

## Root Cause

The scheduled message processor (`process-whatsapp-queue`) resolves the WhatsApp session from the **group's** `session_id`, not the **workshop's** `whatsapp_session_id`. The workshop was reassigned to the working session `07e810ce`, but the linked group (`bc86835e`) still belongs to the dead session `857bbdfb`.

Meanwhile, the same WhatsApp group already exists under the new session as `53b29ad9` (active, connected). The workshop just needs to be linked to this correct group record.

Manual "Send Now" works because it uses the workshop's session ID directly.

## Changes

### 1. Immediate Data Fix (SQL)

- Update `workshop_whatsapp_groups` to link to the correct group `53b29ad9` (belonging to the active session)
- Update the 3 pending scheduled messages to target the new group ID so they send correctly at 7:00, 7:05, 7:10 PM

```sql
-- Re-link workshop to the correct group under the active session
UPDATE workshop_whatsapp_groups 
SET group_id = '53b29ad9-f47a-4782-b363-c4606c647e74'
WHERE workshop_id = '47e38f71-42f9-4f44-9a8c-c62e70b5e74a' 
  AND group_id = 'bc86835e-4c5f-4018-a3aa-79384a5a18c6';

-- Fix pending messages so they use the active group
UPDATE scheduled_whatsapp_messages 
SET group_id = '53b29ad9-f47a-4782-b363-c4606c647e74'
WHERE workshop_id = '47e38f71-42f9-4f44-9a8c-c62e70b5e74a' 
  AND status = 'pending';
```

### 2. Edge Function Fix -- Resolve session from workshop (structural fix)

Modify `process-whatsapp-queue/index.ts` to resolve the session via the **workshop's** `whatsapp_session_id` instead of the group's `session_id`. This prevents future mismatches when a workshop is reassigned to a new session but old groups are still linked.

The query changes from:
```
whatsapp_groups!inner(group_jid, session_id, whatsapp_sessions!inner(session_data))
```
To also join via the workshop:
```
whatsapp_groups!inner(group_jid),
workshops!inner(whatsapp_session_id, whatsapp_sessions:whatsapp_sessions!inner(session_data))
```

This way the edge function always uses the workshop's currently assigned session, matching what "Send Now" does.

## Technical Details

### File: `supabase/functions/process-whatsapp-queue/index.ts`

Update the query (lines 91-104) to join through the workshop instead of the group for session resolution:

```typescript
const { data: pendingMessages, error: fetchError } = await supabase
  .from('scheduled_whatsapp_messages')
  .select(`
    *,
    whatsapp_groups!inner(group_jid),
    workshops!inner(
      whatsapp_session_id,
      session:whatsapp_sessions!whatsapp_session_id(session_data)
    )
  `)
  .eq('status', 'pending')
  .lte('scheduled_for', now)
  .order('scheduled_for', { ascending: true })
  .limit(50);
```

Update session resolution (lines 125-131):

```typescript
const group = msg.whatsapp_groups;
if (!group?.group_jid) {
  throw new Error('Missing group configuration');
}

const workshop = msg.workshops;
const sessionData = workshop?.session?.session_data as { vps_session_id?: string } | null;
const vpsSessionId = sessionData?.vps_session_id || `wa_${workshop?.whatsapp_session_id}`;
```

And similarly update lines 206-208 in the DLQ section to use `workshop.whatsapp_session_id`.

### Files Modified

- **Database**: Two UPDATE statements (group link + pending messages)
- `supabase/functions/process-whatsapp-queue/index.ts` -- resolve session from workshop instead of group

