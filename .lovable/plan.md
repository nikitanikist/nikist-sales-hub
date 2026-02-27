

# Voice Calling Module -- 11 Bug Fixes from Audit Report

## Summary

Apply all 11 fixes identified in your senior developer's audit report. The root cause is that tool call handlers (`mark_attendance`, `reschedule_lead`) set `status: "completed"` prematurely, preventing the post-call webhook from writing duration, cost, transcript, and recording.

## Files to Modify

| File | Fixes |
|------|-------|
| `supabase/functions/bolna-webhook/index.ts` | Fix 1, 2A, 5, 6, 7, 8, 11 |
| `supabase/functions/stop-voice-campaign/index.ts` | Fix 2B |
| `supabase/functions/start-voice-campaign/index.ts` | Fix 3, 10 |
| `src/pages/calling/CallingCampaignDetail.tsx` | Fix 9 |

Fix 4 (migration verification) is already confirmed deployed -- the `transition_call_to_terminal` function uses correct column names (`call_duration_seconds`, `total_cost`).

## All Fixes

### Fix 1 -- Tool calls must NOT set terminal status (CRITICAL)

Remove `status: "completed"` from both `mark_attendance` (line 51) and `reschedule_lead` (line 69) handlers. Only set `outcome` -- let the post-call webhook handle the terminal transition with duration/cost/transcript.

### Fix 2 -- Wrong column name `type` to `integration_type` (CRITICAL)

- **2A**: `bolna-webhook/index.ts` line 99: `.eq("type", "aisensy")` to `.eq("integration_type", "aisensy")`
- **2B**: `stop-voice-campaign/index.ts` line 52: `.eq("type", "bolna")` to `.eq("integration_type", "bolna")`

Also add warning logs before the AiSensy block when `templateId` or `whatsappLink` is missing.

### Fix 3 -- Campaign start delay 150s to 30s (HIGH)

`start-voice-campaign/index.ts`: Change `setTimeout` from 3000 to 2000ms, and scheduling buffer from 150000ms to 30000ms.

### Fix 5 -- Fallback path skips counters (HIGH)

When `transition_call_to_terminal` RPC fails, the fallback (lines 250-258) currently only writes status + bolna_call_id. Update it to also write outcome, duration, cost, transcript, recording, extracted_data AND increment counters (calls_completed + outcome counter + cost).

### Fix 6 -- Phone matching reuses mutable query builder (HIGH)

Extract the campaign ID lookup first, then create a fresh `supabase.from()` query inside the loop for each phone variant instead of reusing the mutable builder.

### Fix 7 -- else branch only updates transcript (HIGH)

When `wasFirst` is false (not the first terminal transition), also fill in missing `call_duration_seconds`, `total_cost`, `recording_url`, and `extracted_data` -- not just transcript.

### Fix 8 -- Cost doubling via accumulator race (MEDIUM)

Replace `add_campaign_cost` RPC with a SUM-based recalculation: query all `voice_campaign_calls.total_cost` for the campaign and write the sum directly to `voice_campaigns.total_cost`.

### Fix 9 -- Status flicker on page reopen (MEDIUM)

Replace `liveCampaign || campaign` with a `useMemo` that compares `updated_at` timestamps and uses whichever is more recent. Add a reset effect to clear `liveCampaign` when `campaign` data refreshes.

### Fix 10 -- Inconsistent `uses_env_secrets` handling (LOW)

`start-voice-campaign/index.ts` line 59: Add `uses_env_secrets` to the select query and resolve `api_key` vs `api_key_secret` based on the flag (matching the pattern already used in `stop-voice-campaign`).

### Fix 11 -- `call_started_at` never set (LOW)

Before calling `transition_call_to_terminal`, calculate `call_started_at` from `now - duration` and update if not already set.

## Deployment

All three edge functions will be deployed after editing. Frontend changes deploy automatically.

## Testing Checklist

After deployment, run a test campaign with 2-3 contacts and verify:
- Campaign starts within ~1 minute
- Duration and cost appear after call ends
- Outcome counters increment correctly
- Campaign total cost matches sum of individual calls
- No status flicker when reopening campaign detail
- Stop campaign works
- WhatsApp group link sends when configured
