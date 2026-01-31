

# Fix: Sync Groups Should Replace, Not Append

## Problem
The VPS now returns 68 groups (down from 135), but the portal still shows 135 because:
- Current logic uses **upsert** which only adds/updates groups
- Groups that no longer exist on WhatsApp are **never removed** from the database
- Result: stale "ghost" groups accumulate over time

## Solution
Before upserting new groups, **delete all existing groups for this session** first. This ensures the database exactly mirrors what VPS returns.

## Changes Required

### File: `supabase/functions/vps-whatsapp-proxy/index.ts`

**Location:** Inside the `sync-groups` handler (around line 494)

**Before the upsert loop, add:**
```typescript
// Delete all existing groups for this session before fresh insert
// This ensures we don't have stale groups that no longer exist on WhatsApp
await supabase
  .from('whatsapp_groups')
  .delete()
  .eq('session_id', localSessionIdForDb);
```

**Why this works:**
1. Deletes all groups for the current session (clean slate)
2. Then inserts fresh groups from VPS (exactly 68)
3. Database now matches VPS exactly

**Alternative (update-based):**
```typescript
// Mark all groups for this session as inactive first
await supabase
  .from('whatsapp_groups')
  .update({ is_active: false })
  .eq('session_id', localSessionIdForDb);

// Then upsert sets is_active: true only for groups that exist
```

I'll use the delete approach as it's cleaner and avoids accumulating inactive records.

---

## Implementation

| Step | Description |
|------|-------------|
| 1 | Add delete statement before the upsert loop in sync-groups handler |
| 2 | Deploy edge function |
| 3 | Re-sync groups - should show exactly 68 |

## Expected Result
- After sync, group count will match VPS exactly (68)
- No more stale/orphaned groups in database
- Future syncs will always be accurate

