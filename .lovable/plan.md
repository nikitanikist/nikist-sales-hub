

# Fix Race Condition in Voice Campaign Webhooks

## Root Cause: Concurrent Webhook Race Condition

Bolna sends multiple `post_call` webhooks simultaneously (for retries and status updates). Currently, the webhook:
1. Reads the call record (status: "queued")
2. Checks `wasAlreadyTerminal` -- all concurrent requests see "queued", so they all pass
3. Each one increments counters independently

With 3 contacts and Bolna sending ~12 webhooks, each one increments `calls_completed`, resulting in 8/3.

## Fix 1: Atomic Status Transition (Database Function)

Create a new database function `transition_call_to_terminal` that atomically:
- Updates the call status only if it's not already terminal (using `WHERE status NOT IN ('completed', 'no-answer', 'busy', 'failed', 'cancelled')`)
- Returns whether this was the first transition (the row was actually updated)
- Only the first webhook to reach the DB wins; all others get "already terminal" response

```sql
CREATE OR REPLACE FUNCTION public.transition_call_to_terminal(
  p_call_id uuid,
  p_status text,
  p_outcome text DEFAULT NULL,
  p_bolna_call_id text DEFAULT NULL,
  p_duration integer DEFAULT 0,
  p_cost numeric DEFAULT 0,
  p_transcript text DEFAULT NULL,
  p_recording_url text DEFAULT NULL,
  p_extracted_data jsonb DEFAULT NULL
) RETURNS TABLE(was_first_transition boolean, campaign_id uuid, previous_outcome text)
```

This function uses `UPDATE ... WHERE status NOT IN (terminal) RETURNING ...` to guarantee atomicity.

## Fix 2: Atomic Cost Accumulation

Create a small database function `add_campaign_cost` that atomically adds cost:
```sql
UPDATE voice_campaigns SET total_cost = total_cost + p_cost WHERE id = p_campaign_id
```
This replaces the current read-then-write pattern that also suffers from race conditions.

## Fix 3: Preserve Tool Call Data (reschedule_day)

The `reschedule_lead` tool call sets `reschedule_day`, but the post_call webhook then updates the same record WITHOUT `reschedule_day`, which means a race can cause the tool call's write to happen BEFORE the post_call reads the record, losing the data.

Fix: In the atomic DB function, use COALESCE to preserve existing values:
- `outcome = COALESCE(p_outcome, existing_outcome)`  
- `reschedule_day` is never overwritten by post_call (it's not in the update)

Also update the `reschedule_lead` tool handler to check for alternative field names from Bolna (e.g., `body.day`, `body.preferred_day`, `body.arguments.reschedule_day`).

## Fix 4: Stale Call Cleanup (Subham stuck as "queued")

The stale call cleanup currently only runs when ANOTHER call's webhook fires after 10 minutes. If Bolna gives up on Subham and never sends a webhook, the cleanup never triggers.

Fix: Reduce the stale timeout from 10 minutes to 5 minutes, and also check during the campaign completion logic to catch these earlier.

## Changes Summary

| File | Change |
|------|--------|
| Database migration | Add `transition_call_to_terminal` and `add_campaign_cost` functions |
| `bolna-webhook/index.ts` | Replace read-then-write pattern with atomic DB function calls |
| `bolna-webhook/index.ts` | Fix `reschedule_day` extraction from Bolna payload |
| `bolna-webhook/index.ts` | Reduce stale timeout to 5 minutes |

## Technical Detail

The key change in the webhook handler:

**Before (race-prone):**
```
1. Read call record
2. Check wasAlreadyTerminal in JS
3. Update call record
4. If !wasAlreadyTerminal, increment counters
```

**After (atomic):**
```
1. Call transition_call_to_terminal() -- atomic DB operation
2. If was_first_transition, increment counters
3. If NOT first transition, only update transcript/cost if better data
```

This guarantees that no matter how many webhooks Bolna sends simultaneously, counters increment exactly once per call.
