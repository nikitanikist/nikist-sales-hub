
# Upgrade Verify Campaign Status to Tier 1 (VPS Verification)

## What Changes

The VPS developer has built a `/message-status` endpoint that returns the `messageId` for messages that were actually delivered. We will update the system to:

1. **Try VPS verification first** -- query each failed group's delivery status from the VPS
2. **Store the recovered `messageId`** -- so read receipts, delivery receipts, and reaction webhooks start working for those groups
3. **Fall back to manual confirmation** -- for groups where VPS doesn't have the messageId (e.g., after VPS restart)

## How It Will Work

When you click "Verify Status" on a failed/partial campaign:
- The system calls VPS `/message-status` for each failed group using the campaign's `session_id` and each group's `group_jid`
- If VPS confirms delivery and returns a `messageId`, the group is marked as "sent" WITH the messageId stored -- enabling analytics (read, delivered, reactions)
- Groups where VPS has no record remain failed, and you get a summary showing how many were auto-verified vs still unresolved
- For remaining unresolved groups, you can still use "Mark as Delivered" (Tier 2) as a fallback

## UI Changes

The current single "Mark as Delivered" button will be replaced with two options:
- **"Verify Status"** (primary) -- calls VPS to auto-verify and recover messageIds
- **"Mark as Delivered"** (secondary, shown after verify if some groups remain failed) -- manual confirmation for groups VPS couldn't verify

## Technical Details

### Edge Function Update (`supabase/functions/verify-campaign-status/index.ts`)

The function will support two modes via the request body:

**Mode 1: `manual_confirm: false` (default) -- VPS Verification**
```text
1. Fetch campaign + session_id
2. Get all failed groups for this campaign
3. For each failed group, POST to VPS /message-status with { sessionId, groupJid }
4. If VPS returns { found: true, messageId }, update group:
   - status -> "sent"
   - message_id -> recovered messageId (enables analytics webhooks)
   - sent_at -> VPS timestamp or now
   - error_message -> null
5. Recalculate campaign sent_count, failed_count, status
6. Return: { verified: X, still_failed: Y, total: Z }
```

**Mode 2: `manual_confirm: true` -- Manual Fallback (unchanged)**
- Marks all remaining failed groups as "sent" without messageId
- Analytics won't work for these, but counts are corrected

### VPS Call Pattern
```text
POST {WHATSAPP_VPS_URL}/message-status
Headers: { "X-API-Key": WHATSAPP_VPS_API_KEY, "Content-Type": "application/json" }
Body: { "sessionId": "...", "groupJid": "..." }
Response: { "success": true, "found": true, "messageId": "...", "status": "sent", "timestamp": ... }
```

Uses existing `WHATSAPP_VPS_URL` and `WHATSAPP_VPS_API_KEY` secrets (already configured).

### UI Update (`src/pages/whatsapp/CampaignDetail.tsx`)

- Rename existing button from "Mark as Delivered" to "Verify Status"
- Change `handleVerifyStatus` to call with `manual_confirm: false` first
- Show results toast: "4 of 6 groups verified via VPS. 2 groups still failed."
- If groups remain failed after verification, show a secondary "Mark Remaining as Delivered" button for Tier 2 fallback
- After Tier 1 verify, the button text updates to reflect remaining unverified groups

### Files to Modify
| File | Change |
|------|--------|
| `supabase/functions/verify-campaign-status/index.ts` | Add VPS /message-status calls with messageId recovery |
| `src/pages/whatsapp/CampaignDetail.tsx` | Split into Verify (Tier 1) + Mark as Delivered (Tier 2) buttons |

No database changes needed -- `message_id` column already exists on `notification_campaign_groups`.
