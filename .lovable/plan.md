

# Feature: Fetch WhatsApp Group Invite Links On-Demand

## Overview

Since the VPS `/groups/{sessionId}` endpoint doesn't return invite links in the sync response, we need to fetch them on-demand using the confirmed working endpoint: `GET /groups/{sessionId}/{groupJid}/invite`

---

## Current State

| What Works | What's Missing |
|------------|----------------|
| UI displays invite links when present (lines 433-464) | Groups from sync have `invite_link: null` |
| VPS endpoint `GET /groups/{sessionId}/{groupJid}/invite` is live | Edge function doesn't have `get-invite-link` action |
| Groups are synced and shown | No way to fetch individual invite links |

---

## Implementation Plan

### 1. Update Edge Function

**File:** `supabase/functions/vps-whatsapp-proxy/index.ts`

Add `get-invite-link` to the action type and handle the new action:

```typescript
// In VPSProxyRequest interface (line 99), add:
action: 'connect' | 'status' | 'disconnect' | 'send' | 'health' | 'sync-groups' | 'create-community' | 'get-invite-link';
groupJid?: string;  // Add this new field

// Add new case in switch statement:
case 'get-invite-link': {
  if (!sessionId) {
    return error response for missing sessionId;
  }
  const { groupJid } = body;
  if (!groupJid) {
    return error response for missing groupJid;
  }
  
  // Lookup VPS session ID from local session UUID
  vpsSessionIdForVps = await getVpsSessionId(supabase, sessionId);
  
  // Call VPS: GET /groups/{sessionId}/{groupJid}/invite
  vpsEndpoint = `/groups/${vpsSessionIdForVps}/${groupJid}/invite`;
  vpsMethod = 'GET';
  
  // After getting response, update the database
  // and return the invite link
}
```

### 2. Add Hook Mutation

**File:** `src/hooks/useWhatsAppGroups.ts`

Add a `fetchInviteLink` mutation:

```typescript
const fetchInviteLinkMutation = useMutation({
  mutationFn: async ({ sessionId, groupId, groupJid }: { 
    sessionId: string; 
    groupId: string;
    groupJid: string;
  }) => {
    const response = await supabase.functions.invoke('vps-whatsapp-proxy', {
      body: {
        action: 'get-invite-link',
        sessionId,
        groupJid,
        organizationId: currentOrganization?.id,
      },
    });
    
    if (response.error) throw response.error;
    
    // Update local database with the fetched link
    if (response.data?.invite_link) {
      await supabase
        .from('whatsapp_groups')
        .update({ invite_link: response.data.invite_link })
        .eq('id', groupId);
    }
    
    return response.data;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['whatsapp-groups'] });
    toast.success('Invite link fetched');
  },
  onError: (error) => {
    toast.error('Failed to get invite link: ' + error.message);
  },
});
```

### 3. Update UI with "Get Link" Button

**File:** `src/components/operations/WorkshopDetailSheet.tsx`

In the linked groups section (around line 421-467), add a "Get Link" button for groups without invite links:

```
Current UI (group WITH invite link):
┌────────────────────────────────────────┐
│ 👥 group test 1                        │
│    🔗 ABC123xyz  [📋] [↗]              │
└────────────────────────────────────────┘

New UI (group WITHOUT invite link):
┌────────────────────────────────────────┐
│ 👥 Crypto Masterclass <> 1st Feb       │
│    [🔗 Get Invite Link]                │
└────────────────────────────────────────┘
```

Button behavior:
- Shows loading spinner while fetching
- Calls `fetchInviteLink` mutation
- On success: link appears, button disappears
- On error: shows toast with message

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/vps-whatsapp-proxy/index.ts` | Add `get-invite-link` action handler |
| `src/hooks/useWhatsAppGroups.ts` | Add `fetchInviteLink` mutation and return it |
| `src/components/operations/WorkshopDetailSheet.tsx` | Add "Get Link" button for groups without `invite_link` |

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Not admin of group | VPS returns error, show toast: "You must be admin to get invite link" |
| VPS returns error | Show error toast with message |
| Link already exists | Don't show button, show the link |
| Fetching in progress | Show spinner, disable button |
| Multiple groups without links | Each group has its own "Get Link" button |

---

## VPS Request/Response

**Request:**
```
GET /groups/{vps_session_id}/{group_jid}/invite
Headers: X-API-Key: {api_key}
```

**Expected Response:**
```json
{
  "inviteCode": "ABC123xyz",
  "inviteLink": "https://chat.whatsapp.com/ABC123xyz"
}
```

