
# Fix: Add "sync-groups" Action to WhatsApp VPS Proxy

## Problem Identified

The "Sync WhatsApp Group" button fails with **"Edge function return is none"** because:

1. The frontend (`useWhatsAppGroups.ts`) calls the edge function with `action: 'sync-groups'`
2. The edge function (`vps-whatsapp-proxy/index.ts`) only handles these actions: `connect`, `status`, `disconnect`, `send`, `health`
3. The `sync-groups` action falls through to the `default` case and returns an "Invalid action" error
4. This causes the mutation to fail with a confusing error message

## Solution

Add a new `sync-groups` case to the edge function that:
1. Calls the VPS `/groups/:sessionId` endpoint to fetch all WhatsApp groups
2. Stores the groups in the `whatsapp_groups` database table
3. Returns the synced groups to the frontend

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/vps-whatsapp-proxy/index.ts` | Add `sync-groups` action handler |

---

## Technical Implementation

### 1. Update VPSProxyRequest Interface

Add `sync-groups` to the allowed actions:

```typescript
interface VPSProxyRequest {
  action: 'connect' | 'status' | 'disconnect' | 'send' | 'health' | 'sync-groups';
  sessionId?: string;
  organizationId?: string;
  groupId?: string;
  message?: string;
  mediaUrl?: string;
  mediaType?: string;
}
```

### 2. Add sync-groups Case in Switch Statement

After the `send` case (around line 260), add:

```typescript
case 'sync-groups': {
  if (!sessionId || !organizationId) {
    return new Response(
      JSON.stringify({ error: 'Session ID and Organization ID are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  localSessionIdForDb = sessionId;
  vpsSessionIdForVps = await getVpsSessionId(supabase, sessionId);
  
  if (!vpsSessionIdForVps) {
    console.warn('No VPS session ID found in DB, using sessionId directly as fallback');
    vpsSessionIdForVps = sessionId;
  }
  
  // Call VPS to get groups - typical endpoint is /groups/:sessionId
  vpsEndpoint = `/groups/${vpsSessionIdForVps}`;
  vpsMethod = 'GET';
  break;
}
```

### 3. Handle sync-groups Response (Store Groups in DB)

After the existing status update block (around line 394), add logic to store groups when the action is `sync-groups`:

```typescript
// Store groups for sync-groups action
if (action === 'sync-groups' && isJson && localSessionIdForDb && organizationId) {
  const vpsGroups = responseData?.groups || responseData || [];
  
  if (Array.isArray(vpsGroups) && vpsGroups.length > 0) {
    // Upsert groups into database
    const groupsToUpsert = vpsGroups.map((g: any) => ({
      organization_id: organizationId,
      session_id: localSessionIdForDb,
      group_jid: g.id || g.jid || g.groupId,
      group_name: g.name || g.subject || 'Unknown Group',
      participant_count: g.participants?.length || g.size || 0,
      is_active: true,
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    
    const { error: upsertError } = await supabase
      .from('whatsapp_groups')
      .upsert(groupsToUpsert, { 
        onConflict: 'group_jid,organization_id',
        ignoreDuplicates: false 
      });
    
    if (upsertError) {
      console.error('Failed to upsert groups:', upsertError);
    } else {
      console.log(`Synced ${groupsToUpsert.length} groups`);
    }
    
    // Return groups count to frontend
    return new Response(
      JSON.stringify({ 
        success: true, 
        groups: groupsToUpsert,
        count: groupsToUpsert.length 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  // No groups found
  return new Response(
    JSON.stringify({ success: true, groups: [], count: 0 }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

---

## VPS Requirement

**Important**: This fix assumes your VPS has a `/groups/:sessionId` endpoint that returns WhatsApp groups. If your VPS uses a different endpoint, you'll need to update the `vpsEndpoint` path accordingly.

The expected response from VPS should be an array of groups like:
```json
{
  "groups": [
    { "id": "120363xxx@g.us", "name": "My Group", "participants": [...] },
    ...
  ]
}
```

If your VPS doesn't have this endpoint yet, you'll need to add it to your Baileys service:

```javascript
// In your VPS server
app.get('/groups/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  
  if (!session?.socket) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  try {
    const groups = await session.socket.groupFetchAllParticipating();
    const groupList = Object.values(groups).map(g => ({
      id: g.id,
      name: g.subject,
      participants: g.participants
    }));
    res.json({ groups: groupList });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## Expected Behavior After Fix

1. User clicks "Sync WhatsApp Group"
2. Edge function receives `action: 'sync-groups'`
3. Edge function calls VPS `/groups/wa_xxx` endpoint
4. VPS returns list of WhatsApp groups
5. Edge function stores groups in `whatsapp_groups` table
6. Frontend shows "Synced X groups" toast
7. Groups appear in the UI for linking to workshops
