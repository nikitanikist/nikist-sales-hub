

# Fix Voice Campaign Data Not Saving (Duration, Cost, Outcome, Counters)

## Root Cause Analysis

After investigating the webhook logs, I found **two bugs** that explain ALL the symptoms:

### Bug 1: PostgreSQL Integer Type Error (causes missing outcome, duration, cost, transcript, and zero counters)

The logs show repeated errors:
```
transition_call_to_terminal error: invalid input syntax for type integer: "0.0"
```

Bolna sends `duration` as a float (e.g., `0.0`), but the database function parameter `p_duration` is declared as `integer`. PostgreSQL rejects the value at the RPC boundary -- **before** the function body runs (where the `FLOOR()` cast would have fixed it). 

Because the atomic function fails, the webhook falls back to a basic update that only sets `status` and `call_ended_at`. This means:
- Outcome: never saved (shows "--")
- Duration: never saved (shows "--")  
- Cost: never saved at call level (shows "--")
- Transcript: never saved
- Counters: never incremented (calls_completed stays 0, confirmed stays 0, etc.)
- Progress: stays at 0%

Then when a second webhook arrives, the call is already terminal, so `wasFirst=false` and counters still don't increment.

### Bug 2: Cost Accumulates on Every Webhook (causes cost doubling)

The `add_campaign_cost` RPC call is placed **outside** the `wasFirst` check (line 298). This means every webhook from Bolna adds cost to the campaign total, even duplicate ones. With 2 contacts and ~4 webhooks each, cost doubles or triples.

## Fix

**File: `supabase/functions/bolna-webhook/index.ts`**

### Change 1: Cast duration to integer in JavaScript before passing to RPC

```typescript
// Before the RPC call, add:
const safeDuration = Math.floor(Number(duration) || 0);
const safeCost = Number(cost) || 0;

// Then pass safeDuration and safeCost to the RPC:
p_duration: safeDuration,
p_cost: safeCost,
```

This ensures PostgreSQL receives a clean integer, preventing the type error that breaks everything.

### Change 2: Move cost accumulation inside the `wasFirst` check

Move `add_campaign_cost` from its current position (always runs) to inside the `if (wasFirst)` block, so cost is only added once per call:

```typescript
if (wasFirst) {
  // Increment counters...
  
  // Add cost only once
  if (safeCost > 0) {
    await supabase.rpc("add_campaign_cost", { 
      p_campaign_id: callRecord.campaign_id, 
      p_cost: safeCost 
    });
  }
}
```

Remove the standalone `add_campaign_cost` call that currently runs unconditionally.

## What This Fixes

| Symptom | Cause | Fixed By |
|---------|-------|----------|
| Outcome showing "--" | RPC fails, fallback skips outcome | Change 1 |
| Duration showing "--" | RPC fails, fallback skips duration | Change 1 |
| Cost showing "--" in table | RPC fails, fallback skips cost | Change 1 |
| Transcript not saved | RPC fails, fallback skips transcript | Change 1 |
| Counters all zero | RPC fails, wasFirst never true | Change 1 |
| Progress 0% | Counters zero | Change 1 |
| Campaign cost doubling | add_campaign_cost runs on every webhook | Change 2 |
| Cost mismatch list vs detail | Cost keeps incrementing on re-open | Change 2 |

## Status Flickering on Re-open

When you leave the detail page and return, React Query refetches fresh data. During that brief refetch, the component may show stale cached data momentarily. This is normal React Query behavior and not a bug -- once the refetch completes (fraction of a second), the correct data appears.

No database migration needed -- the existing function is fine, the problem is the JavaScript passing a float where an integer is expected.

