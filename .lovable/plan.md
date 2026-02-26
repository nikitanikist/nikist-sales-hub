

# Increase WhatsApp VPS Timeout to Prevent False Failures

## Problem

WhatsApp campaigns are marked as "failed" in the dashboard even though messages were actually delivered. This happens because the VPS takes longer than 10 seconds to respond (it waits for WhatsApp delivery confirmation before returning), and our system times out and records it as a failure.

The Feb 23rd campaigns ("AI Metal Trading Bootcamp Research Form", "24hr msg", "before 24hr msg") all show failed_count=1, sent_count=0 -- but messages were received in WhatsApp groups.

## Fix

**File: `supabase/functions/process-whatsapp-queue/index.ts`**

Change line 54 from:
```typescript
}, 10000);
```
to:
```typescript
}, 30000);
```

This increases the timeout from 10 seconds to 30 seconds for the VPS `/send` endpoint. The VPS is working correctly -- it just sometimes takes longer than 10s, especially for media messages.

## What This Fixes

- Campaigns will no longer be falsely marked as "failed" when messages are actually delivered
- No changes needed on the VPS side
- All other WhatsApp-related timeouts (reminders, closer notifications, etc.) remain at 10s since those are simpler API calls

## Note on Old Failed Campaigns

The 3 campaigns from Feb 23rd that show as "failed" cannot be retroactively corrected -- they were already finalized. But this fix prevents the same issue going forward.

No database migration needed.

