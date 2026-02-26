

# Fix: Increase Scheduling Buffer to Meet Bolna's 2-Minute Minimum

## Problem
Bolna's API returned: "Scheduled time should be at least 2 minutes in the future." The previous fix reduced the buffer to 30 seconds, but `bypass_call_guardrails` does not skip this particular validation.

## Fix

**File: `supabase/functions/start-voice-campaign/index.ts`**

Change the buffer from `30000` (30 seconds) to `130000` (2 minutes 10 seconds). This gives a safe margin above Bolna's 2-minute minimum while being much faster than the original 2.5 minutes.

The `bypass_call_guardrails` parameter will be kept since it may help with other time-of-day restrictions, but the buffer itself must respect the 2-minute hard minimum.

This reduces the total delay from ~7 minutes to ~2.5 minutes (2m10s buffer + 3s processing delay + Bolna's own startup time).

