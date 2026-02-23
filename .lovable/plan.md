

# Fix: Failed WhatsApp Campaign Linked to Dead Session

## Problem

The campaign "6:57 we are live" failed because it was created using session `857bbdfb` (now dead/disconnected). The `process-notification-campaigns` edge function correctly detected the disconnected session and marked everything as failed. Unlike the workshop scheduler, campaigns store `session_id` directly on the campaign record.

The campaign creation page already filters to connected sessions only, so new campaigns won't have this issue. The fix needed is for this specific failed campaign and to add a "Retry with different session" capability.

## Changes

### 1. Immediate Data Fix (SQL)

Reset the failed campaign to use the working session `07e810ce` and re-queue it:

```sql
-- Update campaign to use the working session and reset to 'sending'
UPDATE notification_campaigns 
SET session_id = '07e810ce-e7c3-4b42-accb-de65d4dbf226',
    status = 'sending',
    started_at = NULL,
    completed_at = NULL,
    sent_count = 0,
    failed_count = 0
WHERE id = '6ecf2cb1-891e-4cc8-8d6a-a1c298aeaebe';

-- Reset the failed group back to pending
UPDATE notification_campaign_groups 
SET status = 'pending',
    error_message = NULL
WHERE campaign_id = '6ecf2cb1-891e-4cc8-8d6a-a1c298aeaebe';
```

This will cause the next scheduled invocation of `process-notification-campaigns` to pick it up and re-send using the working session.

### 2. UI: Add "Retry Campaign" button on Campaign Detail page

On the `CampaignDetail.tsx` page, when a campaign has status `failed` or `partial_failure`, show a "Retry" button that:
- Lets the user pick a connected session
- Resets the campaign status to `sending` and failed groups back to `pending`
- Triggers the processor

### Technical Details

**File: `src/pages/whatsapp/CampaignDetail.tsx`**
- Add a retry button visible when `campaign.status === 'failed' || campaign.status === 'partial_failure'`
- Show a session picker dropdown (filtered to connected sessions)
- On click: update campaign's `session_id`, reset status to `sending`, reset failed groups to `pending`
- Call `process-notification-campaigns` edge function to start processing immediately

**No edge function changes needed** -- the `process-notification-campaigns` logic is already correct; it properly checks session status before sending. The issue was purely stale data.

