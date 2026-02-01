
# Automatic WhatsApp Community Creation for Workshops

## Overview

This feature automatically creates a WhatsApp Community (announcement group) whenever a new workshop is created. The community settings will be configured so that only admins can send messages and edit settings. Users will select which WhatsApp session to use for community creation in the WhatsApp Settings page.

---

## Database Changes

### 1. Add `community_session_id` column to `organizations` table

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `community_session_id` | uuid | Yes | References the WhatsApp session used for auto-creating communities |

This column stores the designated WhatsApp session that will be used when automatically creating communities for new workshops.

### 2. Add `community_group_id` column to `workshops` table

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `community_group_id` | uuid | Yes | References the auto-created WhatsApp community in `whatsapp_groups` table |

Note: The `workshops` table already has `whatsapp_group_id` (legacy single-group) and `whatsapp_session_id`. The new `community_group_id` will specifically track the auto-created community.

---

## New Edge Function: `create-whatsapp-community`

This function orchestrates the community creation by calling your VPS `/create-community` endpoint.

**Request:**
```json
{
  "workshopId": "uuid",
  "workshopName": "Workshop Name",
  "organizationId": "uuid"
}
```

**Flow:**
1. Look up the organization's `community_session_id`
2. If not configured, skip community creation (log and return)
3. Retrieve the VPS session ID from `whatsapp_sessions.session_data`
4. Call VPS `/create-community` endpoint with:
   ```json
   {
     "sessionId": "wa_xxx-xxx",
     "name": "Workshop Name",
     "description": "Workshop community",
     "settings": {
       "announcement": true,
       "restrict": true
     }
   }
   ```
5. On success, insert a new record into `whatsapp_groups` table
6. Link the new group to the workshop via `workshop_whatsapp_groups` junction table
7. Update `workshops.community_group_id` with the new group ID
8. Return success with `groupId` and `inviteLink`

**Error Handling:**
- If no community session is configured: Silent skip (workshop still created)
- If VPS call fails: Log error, return error response (workshop still created)
- If session is disconnected: Log error, skip community creation

---

## Update: `vps-whatsapp-proxy` Edge Function

Add a new action `create-community` to the existing proxy function.

```typescript
case 'create-community': {
  if (!sessionId || !name) {
    return Response(JSON.stringify({ error: 'Session ID and name required' }), ...);
  }
  
  vpsSessionIdForVps = await getVpsSessionId(supabase, sessionId);
  vpsEndpoint = '/create-community';
  vpsMethod = 'POST';
  vpsBody = {
    sessionId: vpsSessionIdForVps,
    name,
    description: description || 'Workshop community',
    settings: {
      announcement: true,
      restrict: true
    }
  };
  break;
}
```

---

## Frontend Changes

### 1. WhatsApp Settings Page (`src/pages/settings/WhatsAppConnection.tsx`)

Add a new card for "Community Creation Settings":

**UI Components:**
- Card titled "Community Creation Settings"
- Description: "Select which WhatsApp number should be used to auto-create communities when new workshops are added"
- Dropdown selector showing connected sessions only
- "Save" button to persist the selection

**Data Flow:**
- Fetch current `community_session_id` from organizations table
- On save, update the organizations table

### 2. New Hook: `useCommunitySession`

```typescript
export function useCommunitySession() {
  // Fetch organization's community_session_id
  // Mutation to update community_session_id
  // Return: { communitySessionId, setCommunitySession, connectedSessions }
}
```

### 3. Workshops Page (`src/pages/Workshops.tsx`)

**Modify `createMutation`:**
After successful workshop insert, call the `create-whatsapp-community` edge function.

```typescript
const createMutation = useMutation({
  mutationFn: async (newWorkshop) => {
    // Insert workshop
    const { data: workshop } = await supabase.from("workshops").insert([...]).select().single();
    
    // Trigger community creation (non-blocking)
    try {
      await supabase.functions.invoke('create-whatsapp-community', {
        body: {
          workshopId: workshop.id,
          workshopName: workshop.title,
          organizationId: currentOrganization.id
        }
      });
    } catch (err) {
      console.error('Community creation failed:', err);
      // Don't fail the mutation - workshop is still created
    }
    
    return workshop;
  },
  ...
});
```

**UI Feedback:**
- Add loading state while community is being created
- Show toast on success: "Workshop created with WhatsApp community"
- Show warning toast if community creation fails: "Workshop created, but WhatsApp community couldn't be created"

---

## Update: `ingest-tagmango` Edge Function

Add community creation after auto-creating a new workshop.

```typescript
// After creating new workshop (line ~593)
if (workshopId) {
  console.log('Created new workshop:', workshopId);
  
  // Auto-create WhatsApp community for the new workshop
  try {
    const createCommunityResponse = await fetch(
      `${supabaseUrl}/functions/v1/create-whatsapp-community`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          workshopId,
          workshopName: normalizedWorkshopName,
          organizationId: null // Will use default org logic
        })
      }
    );
    
    if (!createCommunityResponse.ok) {
      console.error('Failed to create WhatsApp community:', await createCommunityResponse.text());
    } else {
      console.log('WhatsApp community created for workshop');
    }
  } catch (err) {
    console.error('Error calling create-whatsapp-community:', err);
  }
}
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/create-whatsapp-community/index.ts` | **Create** | New edge function for community creation |
| `supabase/functions/vps-whatsapp-proxy/index.ts` | **Modify** | Add `create-community` action |
| `supabase/config.toml` | **Modify** | Add config for new edge function |
| `src/pages/settings/WhatsAppConnection.tsx` | **Modify** | Add community session selector UI |
| `src/hooks/useCommunitySession.ts` | **Create** | Hook to manage community session setting |
| `src/pages/Workshops.tsx` | **Modify** | Trigger community creation after workshop insert |
| `supabase/functions/ingest-tagmango/index.ts` | **Modify** | Trigger community creation after auto-workshop creation |
| Database migration | **Create** | Add `community_session_id` to organizations, `community_group_id` to workshops |

---

## Implementation Order

1. **Database Migration** - Add new columns
2. **VPS Proxy Update** - Add `create-community` action
3. **New Edge Function** - `create-whatsapp-community`
4. **Frontend Hook** - `useCommunitySession`
5. **WhatsApp Settings UI** - Community session selector
6. **Workshops Page** - Trigger community creation on manual create
7. **Ingest TagMango** - Trigger community creation on auto-create

---

## Error Scenarios

| Scenario | Behavior |
|----------|----------|
| No community session configured | Workshop created, no community (silent) |
| VPS `/create-community` fails | Workshop created, error logged, toast shown |
| WhatsApp session disconnected | Workshop created, community skipped |
| Network error to VPS | Workshop created, error logged |

The workshop creation should never fail due to community creation issues - it's a best-effort enhancement.
