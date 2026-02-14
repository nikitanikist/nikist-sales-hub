

# Fix: Campaign Status Stuck on "Sending" + Zero Analytics

## What went wrong

The edge function `process-notification-campaigns` crashes at line 281 with:
```
TypeError: supabase.rpc(...).catch is not a function
```

**Two bugs combined:**
1. The function calls `supabase.rpc("update_campaign_counts", ...)` but this database function does not exist
2. It chains `.catch()` on the result, but the Supabase JS client returns `{data, error}` -- not a standard Promise that supports `.catch()`

This crash happens *after* messages are successfully sent to groups, so:
- Group-level statuses update correctly ("sent")
- But the campaign never transitions from "sending" to "completed"
- The `sent_count` / `failed_count` on the campaign row stay at 0
- The campaign keeps being picked up by the cron job every minute (stuck in a loop)

## The fix

**File: `supabase/functions/process-notification-campaigns/index.ts`**

Replace the broken RPC call (lines 280-290) with direct count logic + campaign status finalization:

```typescript
// After the group processing loop ends:

// 1. Count actual group statuses from DB
const { data: groupStats } = await supabase
  .from("notification_campaign_groups")
  .select("status")
  .eq("campaign_id", campaign.id);

const finalSent = groupStats?.filter(g => g.status === "sent").length || 0;
const finalFailed = groupStats?.filter(g => g.status === "failed").length || 0;
const finalPending = groupStats?.filter(g => g.status === "pending").length || 0;

// 2. Update campaign counts
await supabase
  .from("notification_campaigns")
  .update({
    sent_count: finalSent,
    failed_count: finalFailed,
  })
  .eq("id", campaign.id);

// 3. If no more pending groups, finalize status
if (finalPending === 0) {
  const finalStatus = finalFailed > 0 && finalSent > 0
    ? "partial_failure"
    : finalFailed > 0
    ? "failed"
    : "completed";

  await supabase
    .from("notification_campaigns")
    .update({
      status: finalStatus,
      completed_at: new Date().toISOString(),
    })
    .eq("id", campaign.id);
}
```

This removes the dependency on the non-existent RPC function, uses proper Supabase client patterns (no `.catch()`), and correctly finalizes the campaign status.

### Technical Detail

No database migration needed. This is a single edge function code fix. The function will be redeployed automatically.

