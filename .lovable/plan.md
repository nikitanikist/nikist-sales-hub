

# Fix Campaign Scheduling Failure

## Root Cause

The "Scheduled time should be at least 2 minutes in the future" error happens because:

1. The schedule timestamp is computed at line 122 (121s in the future)
2. Then a 3-second delay happens at line 120
3. Then the batch creation API call takes several seconds
4. By the time the schedule API receives the timestamp, only ~115 seconds remain -- below Bolna's 2-minute minimum

The timestamp is generated too early, before the batch creation and delays eat into the buffer.

## Fix

Two changes in `supabase/functions/start-voice-campaign/index.ts`:

1. **Move timestamp generation AFTER the 3-second delay** -- compute it right before the schedule call, not before
2. **Increase buffer to 150 seconds** (2 minutes 30 seconds) to account for network latency

```text
Before (broken):
  Line 122: Generate timestamp (121s future)  <-- clock starts
  Line 120: Wait 3 seconds                    <-- 3s consumed
  Lines 102-117: Create batch API call         <-- 2-5s consumed
  Line 136: Schedule call                      <-- only ~113s left, REJECTED

After (fixed):
  Lines 102-117: Create batch API call
  Line 120: Wait 3 seconds
  NEW: Generate timestamp (150s future)        <-- clock starts HERE
  Line 136: Schedule call                      <-- full 150s available
```

This is a one-line move + one number change. No database migration needed.

