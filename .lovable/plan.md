

# Reduce Campaign Start Delay

## Current Situation
When you start a campaign "now", the code adds a **2.5-minute buffer** (150 seconds) to the current time before sending it to Bolna. Combined with the 3-second processing delay, this causes a ~7 minute gap between clicking "Start" and calls actually going out.

## Root Cause
The 150-second buffer was added because Bolna requires scheduled times to be in the future. However, this is overly conservative.

## Fix

**File: `supabase/functions/start-voice-campaign/index.ts`**

Two changes:

1. **Reduce the buffer from 150 seconds to 30 seconds** -- this gives enough margin for network latency while starting calls much sooner.

2. **Add `bypass_call_guardrails=true`** to the schedule API call -- the Bolna docs show this parameter "skips time validation for all calls in this batch," which prevents Bolna from rejecting timestamps that are too close to "now."

The schedule form data will change from:
```
scheduleForm.append("scheduled_at", scheduleTime);
```
To:
```
scheduleForm.append("scheduled_at", scheduleTime);
scheduleForm.append("bypass_call_guardrails", "true");
```

And the time buffer changes from `150000` (2.5 min) to `30000` (30 sec).

This should reduce the total delay from ~7 minutes down to under 1 minute.
