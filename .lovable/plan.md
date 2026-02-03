

# Fix WhatsApp Membership Webhook - Column Name Mismatch

## Root Cause

The edge function is querying a **non-existent column**:
- Code queries: `metadata->vps_session_id`
- Actual column: `session_data` (not `metadata`)

This causes the 500 error:
```
column whatsapp_sessions.metadata does not exist
```

## Current Data Structure

The `whatsapp_sessions` table stores VPS session IDs correctly:
```json
{
  "id": "fd5cd67a-3dc7-44ce-b611-2c3b5cbbf333",
  "session_data": {
    "vps_session_id": "wa_fd5cd67a-3dc7-44ce-b611-2c3b5cbbf333"
  }
}
```

The webhook receives:
```json
{
  "sessionId": "wa_fd5cd67a-3dc7-44ce-b611-2c3b5cbbf333"
}
```

---

## Fix Required

Update `supabase/functions/whatsapp-membership-webhook/index.ts`:

| Line | Current (Broken) | Fixed |
|------|------------------|-------|
| 70 | `metadata->vps_session_id` | `session_data->vps_session_id` |
| 77 | `select("id, organization_id, metadata")` | `select("id, organization_id, session_data")` |
| 92 | `s.metadata?.vps_session_id` | `s.session_data?.vps_session_id` |

---

## Code Changes

### File: `supabase/functions/whatsapp-membership-webhook/index.ts`

**Change 1** - Line 70 (first session lookup):
```typescript
// FROM:
.or(`id.eq.${payload.sessionId},metadata->vps_session_id.eq.${payload.sessionId}`)

// TO:
.or(`id.eq.${payload.sessionId},session_data->vps_session_id.eq.${payload.sessionId}`)
```

**Change 2** - Line 77 (fallback session query):
```typescript
// FROM:
.select("id, organization_id, metadata");

// TO:
.select("id, organization_id, session_data");
```

**Change 3** - Line 92 (session matching logic):
```typescript
// FROM:
const vpsSessionId = s.metadata?.vps_session_id;

// TO:
const vpsSessionId = s.session_data?.vps_session_id;
```

---

## Expected Flow After Fix

```text
VPS sends: { "sessionId": "wa_fd5cd67a-..." }
          │
          ▼
Edge Function queries whatsapp_sessions
WHERE session_data->vps_session_id = "wa_fd5cd67a-..."
          │
          ▼
Found session with organization_id
          │
          ▼
Insert/update workshop_group_members ✓
```

---

## Summary

| Item | Details |
|------|---------|
| **Problem** | Edge function queries `metadata` column that doesn't exist |
| **Solution** | Replace `metadata` with `session_data` (3 occurrences) |
| **File** | `supabase/functions/whatsapp-membership-webhook/index.ts` |
| **Lines to change** | 70, 77, 92 |

Once deployed, the webhook will successfully record join/leave events to the `workshop_group_members` table.

