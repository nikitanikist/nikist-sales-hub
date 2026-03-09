

# Speed Up IVR Campaign Processing

## Current Bottleneck

The `process-ivr-queue` function runs via cron **once per minute** and initiates a **single batch** of calls (max 11, capped by CPS). Then it exits and waits 60 seconds for the next trigger.

With your limits (CPS=11, Concurrent=13), each invocation starts ~11 calls, then waits a full minute. If a call lasts ~20 seconds, those slots sit empty for ~40 seconds before the next batch. For 391 contacts:

```text
Current: 11 calls/batch × 1 batch/min = ~11 calls/min → 391/11 = ~36 min

Target:  Concurrent 13, avg call ~20s → each slot handles ~3 calls/min
         13 slots × 3 = ~39 calls/min → 391/39 = ~10 min
```

The math says your current limits CAN do it in 10 minutes — the code just needs to keep slots filled continuously instead of batch-and-wait.

## The Fix

Refactor `process-ivr-queue` to **loop continuously for up to 50 seconds** instead of processing a single batch and exiting. On each loop iteration:

1. Check how many slots are available (concurrent limit minus active calls)
2. Claim and initiate calls to fill those slots
3. Sleep 3-5 seconds, then repeat
4. Exit before 55 seconds (so it doesn't overlap with the next cron tick)

```text
After fix:
  Cron fires → function loops for 50 seconds
    → every 3-5s: check free slots, fill them immediately
    → slots stay full the entire minute
  
  Result: 13 concurrent × 3 calls/slot/min = ~39 calls/min → ~10 min for 391 contacts
```

## File Changed

**`supabase/functions/process-ivr-queue/index.ts`**
- Wrap the per-campaign processing in an outer loop with a 50-second time budget
- Each iteration: count active calls → calculate available slots → claim & initiate → sleep 3 seconds
- Break when no more queued calls or time budget exhausted
- CPS delay between individual call initiations remains (91ms for CPS=11)

## Technical Detail

The key insight: CPS (calls per second) controls the **rate** of initiation within a batch, while concurrent limit controls **how many can be in-flight simultaneously**. The current code conflates them by capping batch size at CPS. The fix separates them — batch size = available slots, initiation rate = CPS delay between each.

