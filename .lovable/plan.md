

# Fix: IVR Audio Not Playing — Machine Detection Causing Silent Delay

## Root Cause

The `ivr-call-answer` edge function **was called** and returned correct XML. The audio URLs are valid. The XML structure is correct. So why no audio?

The VoBiz `Make Call` API is configured with `machine_detection: "true"` and `machine_detection_time: 5000` in `process-ivr-queue/index.ts`. Here's what happens:

```text
22:12:04  Call initiated
22:12:06  Call ringing
~22:12:10 User answers → VoBiz begins SILENT machine detection (5+ seconds)
22:12:18  Machine detection finishes → answer_url finally called
22:12:18  User hangs up (frustrated by silence) → same second
```

During machine detection, VoBiz listens silently to determine if a human or voicemail answered. The user hears **nothing** for 5-8 seconds, says "hello hello hello," gets no response, and hangs up. VoBiz reports `USER_BUSY` / `Rejected` because the call terminated before audio could play.

## Fix

**File: `supabase/functions/process-ivr-queue/index.ts`**

Remove `machine_detection` and `machine_detection_time` from the VoBiz API call body (lines 122-123). Without machine detection, VoBiz will call the `answer_url` immediately when the call is picked up, and audio will start playing right away.

**Secondary fix (same file):** The `count` returned from the update in `start-ivr-campaign` is always `null` because `{ count: 'exact' }` is not passed. Add this option so the "queued X calls" log works correctly.

**File: `supabase/functions/start-ivr-campaign/index.ts`**

Add `{ count: 'exact' }` to the update query on line 78 so the queued count is reported correctly.

**Deploy:** Both functions after changes.

## Files Changed
- `supabase/functions/process-ivr-queue/index.ts` — Remove machine_detection params
- `supabase/functions/start-ivr-campaign/index.ts` — Fix count reporting

