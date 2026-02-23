

# Automatic Session Migration When a Phone Number Reconnects

## Problem

When a WhatsApp session disconnects and the same phone number reconnects (creating a new session ID), all references to the old session remain stale across the system. This causes:
- Scheduled workshop messages to fail
- Scheduled webinar messages to fail  
- WhatsApp campaigns to fail
- Groups to appear missing/inactive
- Manual intervention required every time

## Root Cause

The system creates a brand new session record (new UUID) each time a phone reconnects. Nothing propagates this new ID to the 5 tables that hold references to the old session:

```text
workshops.whatsapp_session_id
webinars.whatsapp_session_id
whatsapp_groups.session_id
notification_campaigns.session_id (pending/sending only)
organizations.community_session_id
```

## Solution: Auto-Migration on Session Connect

When a new session becomes `connected` and we detect its `phone_number` matches an older disconnected session for the same organization, automatically migrate all references from the old session to the new one.

### Implementation

#### 1. New Database Function: `migrate_whatsapp_session`

A PostgreSQL function that takes `old_session_id` and `new_session_id` and atomically updates all references:

```sql
CREATE OR REPLACE FUNCTION migrate_whatsapp_session(
  p_old_session_id UUID, 
  p_new_session_id UUID
) RETURNS JSONB AS $$
DECLARE
  result JSONB := '{}'::jsonb;
  cnt INTEGER;
BEGIN
  -- Migrate workshops
  UPDATE workshops SET whatsapp_session_id = p_new_session_id
  WHERE whatsapp_session_id = p_old_session_id;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('workshops', cnt);

  -- Migrate webinars
  UPDATE webinars SET whatsapp_session_id = p_new_session_id
  WHERE whatsapp_session_id = p_old_session_id;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('webinars', cnt);

  -- Migrate active/pending campaigns only
  UPDATE notification_campaigns SET session_id = p_new_session_id
  WHERE session_id = p_old_session_id 
    AND status IN ('pending', 'sending', 'scheduled');
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('campaigns', cnt);

  -- Migrate organization community session
  UPDATE organizations SET community_session_id = p_new_session_id
  WHERE community_session_id = p_old_session_id;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('organizations', cnt);

  -- Migrate groups (reactivate under new session)
  UPDATE whatsapp_groups 
  SET session_id = p_new_session_id, is_active = true
  WHERE session_id = p_old_session_id;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('groups', cnt);

  -- Update pending scheduled messages (workshop + webinar)
  UPDATE scheduled_whatsapp_messages swm
  SET group_id = ng.id
  FROM whatsapp_groups og
  JOIN whatsapp_groups ng ON ng.group_jid = og.group_jid 
    AND ng.session_id = p_new_session_id
  WHERE swm.group_id = og.id 
    AND og.session_id = p_old_session_id  -- before migration
    AND swm.status = 'pending';

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### 2. Update `vps-whatsapp-proxy` Edge Function (Status Check Handler)

In the status check handler (~line 790), when a session transitions to `connected` and has a `phone_number`, check for older disconnected sessions with the same phone number in the same organization and call the migration function.

```typescript
// After updating session status to 'connected'...
if (dbStatus === 'connected' && responseData?.phoneNumber) {
  // Find old disconnected sessions with same phone number in same org
  const { data: oldSessions } = await supabase
    .from('whatsapp_sessions')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('phone_number', responseData.phoneNumber)
    .eq('status', 'disconnected')
    .neq('id', localSessionIdForDb);

  if (oldSessions?.length) {
    for (const old of oldSessions) {
      const { data: migrationResult } = await supabase
        .rpc('migrate_whatsapp_session', {
          p_old_session_id: old.id,
          p_new_session_id: localSessionIdForDb
        });
      console.log(`Migrated session ${old.id} -> ${localSessionIdForDb}:`, migrationResult);
    }
  }
}
```

#### 3. Fix `process-webinar-queue` (Same Bug as Workshop Queue)

The webinar queue processor resolves the session from the group instead of the webinar, same as the workshop bug we just fixed. Update it to resolve from the webinar's `whatsapp_session_id`.

Change the query from:
```typescript
whatsapp_groups!inner(group_jid, session_id, whatsapp_sessions!inner(session_data))
```
To:
```typescript
whatsapp_groups!inner(group_jid),
webinars!inner(
  whatsapp_session_id,
  session:whatsapp_sessions!whatsapp_session_id(session_data)
)
```

## Files Modified

1. **New migration** -- Create `migrate_whatsapp_session` database function
2. **`supabase/functions/vps-whatsapp-proxy/index.ts`** -- Add auto-migration logic in the status check handler when a session connects
3. **`supabase/functions/process-webinar-queue/index.ts`** -- Fix session resolution to use webinar's session (same fix as workshop queue)

## What This Solves

After this change, when a user's phone disconnects and they reconnect (even with a new session ID):
- All workshops automatically point to the new session
- All webinars automatically point to the new session
- All pending campaigns automatically point to the new session
- The organization's community session automatically updates
- All groups migrate to the new session and are reactivated
- No manual intervention needed -- everything "just works"
