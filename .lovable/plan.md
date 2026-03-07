
## Fix: Missing Duration, Summary, and Extracted Data in Calling Agent

### Root Cause Analysis

After inspecting the database, the call record for "Amit" has:
- **transcript**: Full conversation present (working correctly)
- **call_duration_seconds**: 0 (incorrect -- a real conversation happened)
- **summary**: null (not received from Bolna)
- **extracted_data**: null (not received from Bolna)
- **total_cost**: 18.53 (working correctly)

**Why duration is 0:** The webhook checks `telephonyData.duration` first, then `body.conversation_duration`, then `body.conversation_time`. Bolna's API docs confirm the field is `conversation_time` at the top level. The code already handles this, but Bolna may have sent it as `0` or not at all in the webhook payload. The webhook only logs the first 500 characters, so we can't see what was actually received.

**Why summary and extracted_data are null:** These are Bolna agent-level features. "Summarization" and "Extraction Prompt" must be enabled in the Bolna agent's Analytics Tab settings. If not configured, Bolna simply doesn't include these fields in the webhook payload.

### Plan

**1. Enhance webhook logging** (file: `supabase/functions/calling-agent-webhook/index.ts`)
- Log key field values individually (conversation_time, duration, summary presence, extracted_data presence) so we can debug future issues without truncation.
- Add `body.duration` as an additional fallback for duration (some Bolna versions use this).

**2. Estimate duration from timestamps when Bolna doesn't provide it**
- If `call_started_at` and `call_ended_at` are both available, calculate duration from them.
- Set `call_started_at` when the call transitions to terminal (backfill using duration or current time).

**3. Backfill the current broken record**
- The existing call for Amit has a full transcript but 0 duration. We can estimate the call lasted roughly 90-120 seconds based on the transcript length. However, we cannot retroactively get the exact duration.
- We will NOT modify existing data -- the fix is forward-looking.

**4. Inform user about Bolna configuration**
- Summary and Extracted Data require enabling "Summarization" and "Extraction Prompt" in the Bolna agent's Analytics/Post-Call settings. Without that, these fields will always be empty. This is not a code bug -- it's a Bolna agent configuration requirement.

### Technical Changes

**File: `supabase/functions/calling-agent-webhook/index.ts`**
- Add detailed field-level logging after parsing the payload
- Add `body.duration` as a fallback: `telephonyData.duration || body.conversation_duration || body.conversation_time || body.duration || 0`
- When duration is still 0 but we have a transcript (indicating a real conversation happened), estimate duration from `call_started_at`/`call_ended_at` timestamps
- Set `call_started_at` on terminal transition if not already set (backfill from duration or webhook receipt time)
- Redeploy the edge function

**No frontend changes needed** -- the UI correctly displays whatever data is in the database. Once the webhook stores duration/summary/extracted_data properly, the UI will show them.
