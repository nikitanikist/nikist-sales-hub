

# Fix Duplicate WhatsApp Groups After Linking New Number

## Problem Summary
After connecting a new WhatsApp number, you see duplicate groups (e.g., the same group appearing 2-3 times) because:
- Groups from old/disconnected WhatsApp sessions remain active in the database
- The sync creates new group entries for the new session
- All groups are fetched regardless of session status

## Solution Overview
When a WhatsApp session is disconnected (or a new one is connected), mark all groups from old/disconnected sessions as inactive. This ensures only groups from the currently connected session are displayed.

## Changes Required

### 1. Deactivate Old Session Groups on Disconnect
**File:** `supabase/functions/vps-whatsapp-proxy/index.ts`

When processing a disconnect action, also mark that session's groups as inactive:
- After updating session status to 'disconnected'
- Set `is_active = false` for all groups belonging to that session

### 2. Deactivate Old Groups Before Syncing New Session  
**File:** `supabase/functions/vps-whatsapp-proxy/index.ts`

When syncing groups for a session:
- First, mark groups from **other** sessions in the same organization as inactive (optional - only if they belong to disconnected sessions)
- Then upsert the new groups as active

### 3. Filter by Connected Session in Hook (Defense in Depth)
**File:** `src/hooks/useWhatsAppGroups.ts`

Update the query to only fetch groups from connected sessions:
- Join with `whatsapp_sessions` table
- Filter by `session.status = 'connected'` OR by a specific session_id

### 4. One-Time Data Cleanup
Run a database cleanup to fix existing duplicate data:
- Mark groups from disconnected sessions as `is_active = false`

---

## Technical Details

### Database Cleanup Query (One-time Fix)
```sql
-- Mark groups from disconnected sessions as inactive
UPDATE whatsapp_groups 
SET is_active = false, updated_at = now()
WHERE session_id IN (
  SELECT id FROM whatsapp_sessions 
  WHERE status = 'disconnected'
);
```

### Edge Function: Disconnect Handler Enhancement
Add after session status update:
```typescript
// Also deactivate groups for this session
await supabase
  .from('whatsapp_groups')
  .update({ is_active: false, updated_at: new Date().toISOString() })
  .eq('session_id', localSessionIdForDb);
```

### Edge Function: Sync Groups Enhancement
Add before upserting new groups:
```typescript
// Deactivate groups from disconnected sessions in this org
await supabase
  .from('whatsapp_groups')
  .update({ is_active: false })
  .eq('organization_id', organizationId)
  .neq('session_id', localSessionIdForDb)
  .in('session_id', (
    // Subquery for disconnected sessions - done via separate query
    disconnectedSessionIds
  ));
```

### Hook Query Enhancement
Update `useWhatsAppGroups.ts`:
```typescript
const { data, error } = await supabase
  .from('whatsapp_groups')
  .select(`
    *,
    session:whatsapp_sessions!inner(status)
  `)
  .eq('organization_id', currentOrganization.id)
  .eq('is_active', true)
  .eq('session.status', 'connected')  // Only from connected sessions
  .order('group_name', { ascending: true });
```

---

## Implementation Steps

| Step | Description |
|------|-------------|
| 1 | Run one-time cleanup query to fix existing data |
| 2 | Update disconnect handler in edge function |
| 3 | Update sync-groups handler in edge function |
| 4 | Update `useWhatsAppGroups` hook to join with sessions |
| 5 | Deploy edge function changes |
| 6 | Test by syncing groups - should see no duplicates |

## Expected Result
- Only groups from the currently connected WhatsApp number will be displayed
- Switching to a different number will automatically update the available groups
- No manual cleanup needed going forward

