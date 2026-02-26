

# Fix Voice Campaign: Counter Inflation, Data Loss, and Stale Status

## Problems Identified

### 1. Counter inflation (8/3 completed, No Answer: 4)
The database function `increment_campaign_counter` always increments `calls_completed` alongside whatever field is passed:
```
SET %I = %I + 1, calls_completed = calls_completed + 1
```
So every counter update (confirmed, rescheduled, no_answer) also inflates `calls_completed`. When the webhook code explicitly increments `calls_completed` AND then increments an outcome field, `calls_completed` goes up by 3+ per call.

### 2. Data disappearing after navigation (statuses reverting to "Queued")
Bolna retries busy/failed calls automatically. When the retry's post-call webhook arrives, the phone lookup filters by `status IN ["queued", "ringing", "in-progress"]`. Since the first webhook already set the status to "busy" or "completed", the retry webhook can't find the record and silently drops the update.

### 3. Campaign stuck as "In Progress"
Same root cause as #2 -- retry webhooks can't match records, so the "pending count" check never reaches zero.

---

## Fixes

### Fix A: Database migration -- Remove `calls_completed` from `increment_campaign_counter`

Update the DB function so it ONLY increments the requested field, not `calls_completed` every time:

```sql
CREATE OR REPLACE FUNCTION public.increment_campaign_counter(p_campaign_id uuid, p_field text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  EXECUTE format(
    'UPDATE public.voice_campaigns SET %I = %I + 1, updated_at = NOW() WHERE id = $1',
    p_field, p_field
  ) USING p_campaign_id;
END;
$$;
```

### Fix B: `supabase/functions/bolna-webhook/index.ts` -- Fix phone matching for retries

Change the phone fallback lookup (line 202) to also match calls in terminal statuses. When a retry arrives for an already-completed call, update only the fields that improved (e.g., longer duration, transcript, cost) but do NOT re-increment counters.

### Fix C: `supabase/functions/bolna-webhook/index.ts` -- Simplify counter logic

- Keep the idempotent check (`wasAlreadyTerminal`) so counters only increment once per call
- Since the DB function no longer auto-increments `calls_completed`, the explicit increment on line 277 will work correctly
- Tool call handlers (mark_attendance, reschedule_lead) should NOT call `increment_campaign_counter` -- let the post-call webhook handle all counting to avoid double-counting

---

## Summary of Changes

| What | Where |
|------|-------|
| Fix DB function to stop auto-incrementing `calls_completed` | Database migration |
| Fix phone matching to handle Bolna retries | `bolna-webhook/index.ts` |
| Remove counter increments from tool call handlers | `bolna-webhook/index.ts` |
| Keep single source of truth for counters in post-call path | `bolna-webhook/index.ts` |

## After Deploying

- Existing campaign counters are still corrupted from the old bug. New campaigns will have correct numbers.
- Bolna retries will now properly update the same call record instead of being silently dropped.
- Campaigns will correctly transition to "completed" once all calls finish (including retries).

