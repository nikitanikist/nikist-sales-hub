
# Fix: WhatsApp Groups Not Saving to Database

## Problem Identified

The edge function logs show the error:
```
ERROR Failed to upsert groups: {
  code: "42P10",
  message: "there is no unique or exclusion constraint matching the ON CONFLICT specification"
}
```

The frontend shows "Synced 27 groups" because the edge function **receives** the groups from the VPS successfully, but the database upsert fails silently. The toast shows the count from the VPS response, not from what was actually saved.

## Root Cause

**Mismatch between edge function code and database schema:**

| Edge Function Code | Database Constraint |
|--------------------|---------------------|
| `onConflict: 'group_jid,organization_id'` | `UNIQUE (session_id, group_jid)` |

The edge function uses `group_jid,organization_id` as the conflict target, but the database only has a unique constraint on `session_id,group_jid`.

---

## Solution

Update the edge function to use the correct conflict columns that match the existing database constraint.

---

## File to Modify

| File | Change |
|------|--------|
| `supabase/functions/vps-whatsapp-proxy/index.ts` | Fix the `onConflict` parameter to use `session_id,group_jid` |

---

## Technical Implementation

**Current code (line ~487-490):**
```typescript
const { error: upsertError } = await supabase
  .from('whatsapp_groups')
  .upsert(groupsToUpsert, { 
    onConflict: 'group_jid,organization_id',  // <-- WRONG
    ignoreDuplicates: false 
  });
```

**Fixed code:**
```typescript
const { error: upsertError } = await supabase
  .from('whatsapp_groups')
  .upsert(groupsToUpsert, { 
    onConflict: 'session_id,group_jid',  // <-- Matches DB constraint
    ignoreDuplicates: false 
  });
```

---

## Expected Behavior After Fix

1. User clicks "Sync Groups"
2. Edge function fetches 27 groups from VPS
3. Edge function upserts groups using correct conflict columns
4. Groups are saved to `whatsapp_groups` table
5. Frontend queries `whatsapp_groups` table
6. Groups appear in the "WhatsApp Groups" section
