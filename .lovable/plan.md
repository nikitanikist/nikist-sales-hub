

# Fix: IVR Campaign "Failed to Start" — Two Root Causes

## Problem

The network logs show the `start-ivr-campaign` edge function returning **404 — "Requested function was not found"**. Two issues are at play:

## Root Cause 1: Edge Functions Not Deployed

The IVR edge functions exist in the codebase but have **never been deployed** to the backend. All 5 IVR functions need deployment:
- `start-ivr-campaign`
- `stop-ivr-campaign`
- `process-ivr-queue`
- `ivr-call-answer`
- `ivr-call-response`
- `ivr-call-hangup`

**Fix:** Deploy all 6 functions.

## Root Cause 2: `getClaims()` Does Not Exist

Both `start-ivr-campaign` and `stop-ivr-campaign` call `supabase.auth.getClaims(token)` — this method **does not exist** in the Supabase JS client. Even once deployed, these functions would crash with a runtime error.

**Fix:** Replace `getClaims` with `supabase.auth.getUser()` (which validates the JWT and returns user data). This matches the pattern used by other edge functions like `start-voice-campaign`.

### Code Change (both files):

**Before:**
```typescript
const token = authHeader.replace("Bearer ", "");
const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
if (claimsError || !claimsData?.claims) { ... }
```

**After:**
```typescript
const { data: { user }, error: userError } = await supabase.auth.getUser();
if (userError || !user) { ... }
```

## VoBiz API Compatibility Audit

After reviewing the VoBiz documentation against our implementation:

| Area | Status | Notes |
|------|--------|-------|
| Make Call API endpoint & auth headers | Correct | `X-Auth-ID`, `X-Auth-Token`, POST to `/Account/{auth_id}/Call/` |
| Make Call parameters | Correct | `from`, `to`, `answer_url`, `hangup_url`, `ring_timeout`, `machine_detection` |
| Gather XML attributes | Correct | `inputType="speech"`, `speechModel="phone_call"`, `language`, `hints`, `speechEndTimeout`, `executionTimeout` |
| Action URL callback params | Correct | Reads `Speech`, `SpeechConfidenceScore`, `InputType` |
| Hangup callback params | Correct | Reads `Duration`, `HangupCause`, `CallStatus`, `CallUUID` |
| Response parsing (`call_uuid`) | Correct | Checks `request_uuid`, `RequestUUID`, `call_uuid` |

No API mismatches found — the VoBiz integration logic is correct.

## Files Changed
- `supabase/functions/start-ivr-campaign/index.ts` — Replace `getClaims` with `getUser`
- `supabase/functions/stop-ivr-campaign/index.ts` — Replace `getClaims` with `getUser`
- Deploy all 6 IVR edge functions

