

# Fix: Prevent Duplicate Campaign Messages (Race Condition)

## The Problem

When you send a campaign, the same message gets delivered 2-4 times to each group. This happens because:

1. A background job runs **every minute** to process campaigns
2. Your campaign with 8 groups and a 15-second delay takes about **2 minutes** to complete
3. While the first job is still sending, a second job starts and picks up the **same groups** (they're still marked as "pending")
4. Both jobs send the message to the same groups, causing duplicates

## The Fix

Add a "claim" step: before sending to a group, the system will **atomically mark it as "processing"** so no other job can pick it up. This is a standard pattern for preventing concurrent processing of the same work item.

## Technical Details

### 1. Add a "processing" status for campaign groups

Create a database migration to add `processing` as a valid status value, and add a `processing_started_at` timestamp column to detect stale claims (in case a job crashes mid-send).

### 2. Update the edge function (`supabase/functions/process-notification-campaigns/index.ts`)

**Claim-before-send pattern:**
- When fetching pending groups, immediately update their status from `pending` to `processing` in a single atomic operation
- Only process groups that were successfully claimed (status changed from `pending` to `processing`)
- After sending, update from `processing` to `sent` or `failed`
- Add a stale claim recovery: if a group has been `processing` for more than 5 minutes, reset it back to `pending` (handles crashed jobs)

The key change (pseudocode):
```text
BEFORE (race-prone):
  1. SELECT groups WHERE status = 'pending'
  2. Send message to each group
  3. UPDATE group SET status = 'sent'
  (Another job can SELECT the same groups between steps 1 and 3)

AFTER (safe):
  1. UPDATE groups SET status = 'processing' WHERE status = 'pending' RETURNING *
  2. Send message to each claimed group
  3. UPDATE group SET status = 'sent'
  (Another job's UPDATE in step 1 returns 0 rows -- nothing to process)
```

### 3. Add campaign-level lock

Before processing a campaign, atomically set a `processing_by` field with a unique job ID. If it's already set (another job is working on it), skip that campaign entirely. Clear it when done.

### 4. Update finalization logic

Update the campaign completion check to account for the new `processing` status -- a campaign isn't done if groups are still in `processing` state.

### 5. Stale lock recovery

Add a cleanup step at the start of each job invocation: any groups stuck in `processing` for more than 5 minutes get reset to `pending`. This handles edge cases where a job crashes or times out.

## Files to Change

- **New migration**: Add `processing` status, `processing_started_at` column, and `processing_by` column to relevant tables
- **`supabase/functions/process-notification-campaigns/index.ts`**: Implement claim-before-send, campaign-level lock, and stale recovery
- **`src/pages/whatsapp/CampaignDetail.tsx`**: Update the retry logic to also reset `processing` groups back to `pending`

