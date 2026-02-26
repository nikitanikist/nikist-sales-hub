

# Add "Fetch Status" Button for False-Failed Campaigns

## Problem
Campaigns show as "failed" because the VPS took too long to respond (timeout), but messages were actually delivered. Retrying would send duplicate messages, which is harmful. You need a safe way to verify and correct the status.

## How It Works
A new "Fetch Status" button appears on failed/partial_failure campaigns. When clicked:
1. It calls a new backend function that asks the VPS "did this message actually get sent to this group?"
2. If the VPS confirms delivery, the group status is updated from "failed" to "sent" (no message is resent)
3. Campaign-level counts and status are recalculated automatically
4. Read/delivered/reaction receipts will then start flowing in normally via existing webhooks

## Changes

### 1. New Edge Function: `verify-campaign-status`
- Accepts a `campaign_id`
- For each group marked "failed" in that campaign, calls the VPS `/message-status` endpoint (or similar) with the `group_jid` and `session_id` to check if the message was actually delivered
- If VPS doesn't have a status endpoint, falls back to a simpler approach: re-query the VPS `/check-message` endpoint. If no such endpoint exists on the VPS, we use a **manual confirmation** approach instead (the button marks groups as "sent" based on your confirmation, since you already verified delivery in WhatsApp)
- Updates groups from "failed" to "sent" where confirmed
- Recalculates campaign `sent_count`, `failed_count`, and `status`

### 2. UI: "Fetch Status" / "Mark as Delivered" Button
On the campaign detail page (`CampaignDetail.tsx`), alongside the existing Retry button for failed campaigns:
- Add a "Verify Status" button that calls the new edge function
- Shows a loading state while checking
- Displays a toast with results ("3 of 5 groups confirmed as delivered")
- Campaign stats refresh automatically after

### 3. Approach Decision
Since the VPS may not have a `/message-status` endpoint, the implementation will use a **two-tier approach**:
- **Tier 1**: Try VPS `/message-status` endpoint -- if it exists, use real verification
- **Tier 2 (fallback)**: If the VPS doesn't support status checks, show a "Mark as Delivered" confirmation dialog that lets you manually confirm that failed groups were actually delivered (since you've already verified in WhatsApp)

## Technical Details

### Edge Function (`supabase/functions/verify-campaign-status/index.ts`)
```text
Input: { campaign_id: string, manual_confirm?: boolean }

Steps:
1. Fetch campaign + session info
2. Get all "failed" groups for this campaign
3. If manual_confirm=true, mark all failed groups as "sent"
4. If manual_confirm=false, try VPS /message-status for each group
5. Recalculate campaign: sent_count, failed_count, status
6. Release: set status to "completed" if all sent, "partial_failure" if mixed
```

### UI Changes (`CampaignDetail.tsx`)
- Add "Verify Status" button next to the retry section
- On click: call verify-campaign-status edge function
- Show confirmation dialog: "You confirmed these messages were received. Mark X failed groups as delivered?"
- After success: invalidate queries to refresh stats

### Config
- Add `verify_jwt = false` entry in `supabase/config.toml`

## Files to Create/Modify
| File | Action |
|------|--------|
| `supabase/functions/verify-campaign-status/index.ts` | Create -- new edge function |
| `supabase/config.toml` | Add verify_jwt config (auto-managed, just noting) |
| `src/pages/whatsapp/CampaignDetail.tsx` | Add Verify Status button + handler |

No database migration needed -- we're only updating existing `status` fields.

