

# Fix Voice Campaign: Phone Number, Counter Bugs, and Campaign Completion

## Issues Found

After analyzing the code, database, and Bolna API docs, I found **4 distinct bugs**:

### Bug 1: Wrong Caller ID
Your Bolna integration config only stores `api_key` — the `from_phone_number` field was never saved. The code correctly sends it IF it exists, but since it's empty, Bolna uses its default number (+912271264229).

**Fix**: You need to update your Bolna integration in Settings > Integrations to add the phone number `+917971543257`. No code change needed — the field already exists in the form.

---

### Bug 2: "No Answer: 9" is Wildly Wrong (Major Bug)
In `bolna-webhook/index.ts` lines 256-259, there's a critical bug:

```text
if (cost > 0) {
  await supabase.rpc("increment_campaign_counter", {
    p_campaign_id: ..., p_field: "calls_no_answer"  // <-- BUG!
  })
```

This increments `calls_no_answer` for EVERY post-call webhook that has a cost, regardless of the actual outcome. So every completed call with a cost also gets counted as "no answer."

**Fix**: Remove this erroneous RPC call entirely. The `calls_no_answer` counter is already correctly incremented in the outcome-based counter logic below (lines 276-288).

---

### Bug 3: "Calls Completed: 15/4" is Wrong
The `calls_completed` counter is never properly managed. It seems to be getting incremented by the erroneous code and/or Bolna's auto-retry mechanism firing multiple webhooks per contact.

**Fix**: Add proper `calls_completed` increment logic in the post-call webhook — increment it exactly once when a call transitions to a terminal status (completed, no-answer, failed, busy, cancelled), and only if the call wasn't already in a terminal status.

---

### Bug 4: Campaign Stuck on "In Progress"
Shivani's phone number (`+9119763173`) is invalid. Bolna never attempted to call it, so her call status stayed "queued" forever. The completion check looks for any non-terminal statuses and found this queued record, so the campaign never completed.

**Fix**: After updating a call record in the post-call webhook, also check how long other "queued" calls have been sitting. If they've been queued for more than 10 minutes after the campaign started, mark them as "failed" (invalid number / skipped by Bolna). This ensures the campaign can complete.

---

## Changes Summary

| File | Change |
|------|--------|
| `supabase/functions/bolna-webhook/index.ts` | Remove erroneous `calls_no_answer` increment on line 257; add proper `calls_completed` increment; add stale-queued-call cleanup logic |
| No UI changes needed | User must update Bolna integration config with `+917971543257` |

## After Deploying

1. Go to **Settings > Integrations**, edit your Bolna/Calling Agent integration, and add `+917971543257` in the "From Phone Number" field.
2. The existing campaign counters are corrupted — the next campaign you create will have correct numbers.
3. Stale queued calls (like Shivani's invalid number) will auto-fail after 10 minutes, allowing the campaign to complete normally.

