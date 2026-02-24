

# Fix: Clean Up Stale WhatsApp Sessions and Prevent Future Deletion Errors

## Problem

There are two issues:

1. **Cannot delete old session history** -- When you try to delete a WhatsApp session, the database cascade tries to delete its linked `whatsapp_groups`, which in turn tries to `SET NULL` on `notification_campaign_groups.group_id`. But `group_id` is a `NOT NULL` column, so the operation fails with a constraint violation.

2. **Runtime errors on page load** -- Stale sessions (status: `connecting`, `qr_pending`, `disconnected`) cause the frontend to check their status against the VPS, which returns 404 "Session not found", flooding the console with errors.

## Root Cause

The foreign key `notification_campaign_groups_group_id_fkey` is defined as `ON DELETE SET NULL`, but the `group_id` column has a `NOT NULL` constraint. These two rules contradict each other.

## What Needs to Happen

### Step 1: Database Migration

Change the foreign key on `notification_campaign_groups.group_id` from `ON DELETE SET NULL` to `ON DELETE CASCADE`. This way, when a whatsapp_group is deleted (because its session was deleted), the related campaign group records are also cleaned up. This is safe because the campaign data is historical and tied to that specific group -- if the group no longer exists, the campaign-group link is meaningless.

### Step 2: Clean Up Stale Sessions

Delete all 9 stale sessions that are not connected and have no phone number:

| Session ID | Status |
|---|---|
| 303d5044-... | qr_pending |
| 07e810ce-... | connecting |
| 8842d937-... | qr_pending |
| caae7ecf-... | qr_pending |
| 2d70b0ef-... | connecting |
| c330db9f-... | qr_pending |
| 857bbdfb-... | disconnected |
| fc78d08a-... | disconnected |
| fd5cd67a-... | connecting |

These sessions have no phone number and are not connected. Their linked groups (580 total) and campaign-group references (37 total) will be cascade-deleted. There are zero pending scheduled messages tied to these groups, so no active functionality is affected.

### Step 3: No Code Changes Needed

The frontend delete button already calls a simple `DELETE FROM whatsapp_sessions WHERE id = ?`. Once the FK constraint is fixed, this will work correctly. The runtime 404 errors will also stop because the stale sessions will no longer exist.

## Technical Details

**Migration SQL:**

```sql
-- Fix the contradictory FK constraint
ALTER TABLE notification_campaign_groups
  DROP CONSTRAINT notification_campaign_groups_group_id_fkey;

ALTER TABLE notification_campaign_groups
  ADD CONSTRAINT notification_campaign_groups_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES whatsapp_groups(id) ON DELETE CASCADE;

-- Clean up stale sessions (cascade will handle groups and campaign_groups)
DELETE FROM whatsapp_sessions
WHERE status IN ('qr_pending', 'connecting', 'disconnected')
  AND phone_number IS NULL;
```

**Impact:** Only historical/orphaned data is removed. All 5 currently connected sessions are untouched.

