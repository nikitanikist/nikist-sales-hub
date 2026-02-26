

# Fix All Voice Campaign Data Issues

## Root Cause (Single Issue Causing Everything)

The `transition_call_to_terminal` database function references **wrong column names**:
- Uses `duration` but the actual column is `call_duration_seconds`
- Uses `cost` but the actual column is `total_cost`

This causes EVERY call to the atomic function to fail with `column "duration" does not exist`. The webhook then falls back to a basic update that only sets `status` and `call_ended_at` -- skipping outcome, transcript, cost, duration, recording_url, and extracted_data.

This single bug explains ALL the symptoms you're seeing:
- Outcome showing as "--" (not saved)
- Reschedule day missing (not saved)
- WhatsApp group info missing (not saved)
- Duration showing "--" (not saved)
- Cost showing "--" (not saved)
- Transcript missing (not saved)
- Progress showing 0% (counters never incremented because `wasFirst` is never true)

There's also a secondary issue: Bolna sends duration as a float (e.g., `0.0`) but the column is integer, causing `invalid input syntax for type integer: "0.0"`.

## Fix: One Database Migration

Recreate the `transition_call_to_terminal` function with:
1. Correct column names: `call_duration_seconds` instead of `duration`, `total_cost` instead of `cost`
2. Cast duration to integer with `FLOOR()` to handle float values from Bolna

No changes needed to the webhook code -- it's already correct. The DB function is the only problem.

## Timing Issue (130s Buffer)

The logs show the campaign started at 13:19:55 and calls completed around 13:30-13:31, a ~10 minute gap. The 130-second buffer accounts for ~2 minutes. The remaining delay is Bolna's own internal processing/scheduling time, which is outside our control. However, we can try reducing the buffer back to the absolute minimum that Bolna accepts. Since Bolna requires "at least 2 minutes in the future," we'll set the buffer to exactly 121 seconds (2 minutes 1 second) to shave off a few more seconds.

## Changes

| What | Change |
|------|--------|
| Database migration | Fix `transition_call_to_terminal`: rename `duration` to `call_duration_seconds`, `cost` to `total_cost`, add `FLOOR()` cast for integer conversion |
| `start-voice-campaign/index.ts` | Reduce buffer from 130000ms to 121000ms (2m 1s -- minimal margin above Bolna's 2-minute requirement) |

