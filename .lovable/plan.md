
# Async WhatsApp Send with Delivery Webhook

## Summary

Your VPS developer has made `/send` asynchronous -- it now responds immediately with `{ accepted: true }` and delivers in the background. After delivery, the VPS calls a webhook on your CRM with the `messageId` (or failure info). We need two changes:

1. **Create a new `whatsapp-send-callback` edge function** to receive delivery confirmations from the VPS
2. **Update `process-notification-campaigns`** to handle the new async flow (groups stay in "processing" until the webhook confirms)

## How It Will Work

```text
BEFORE (synchronous):
  CRM sends -> waits 10s -> VPS returns messageId -> CRM marks "sent"
  (times out after 10s = false failure)

AFTER (asynchronous):
  CRM sends -> VPS returns { accepted: true } immediately -> CRM marks "processing"
  VPS delivers message in background
  VPS calls whatsapp-send-callback webhook -> CRM marks "sent" + stores messageId
```

## Changes

### 1. New Edge Function: `whatsapp-send-callback`

Receives POST from VPS after each message is actually sent (or fails):

```text
Input from VPS:
{
  "event": "message_sent" or "message_failed",
  "sessionId": "wa_xxx",
  "groupJid": "120363xxx@g.us",
  "messageId": "3EB0xxxxx",  // null if failed
  "status": "sent" or "failed",
  "error": null,
  "timestamp": 1708700000000
}
```

Logic:
- Authenticate via `X-API-Key` header (same `WEBHOOK_SECRET_KEY` used by other webhooks)
- Look up the campaign group by `group_jid` that is currently in "processing" status (most recent match)
- If `event = message_sent`: update group to `status: sent`, store `message_id`, set `sent_at`
- If `event = message_failed`: update group to `status: failed`, store `error_message`
- After updating the group, check if all groups for that campaign are done (no more "pending" or "processing") and finalize campaign status/counts

### 2. Update: `process-notification-campaigns`

Current behavior: calls VPS `/send`, waits for response with `messageId`, marks sent/failed immediately.

New behavior:
- Call VPS `/send` -- it returns `{ accepted: true }` instantly
- If accepted: leave group in "processing" status (the webhook will finalize it)
- If VPS rejects or network error: mark as "failed" immediately
- Do NOT finalize campaign status after batch -- the webhook handles that as groups complete
- The existing stale recovery (5-minute timeout) acts as safety net: groups stuck in "processing" for 5+ minutes get reset to "pending" for retry

### 3. Config Update

Add to `supabase/config.toml`:
```toml
[functions.whatsapp-send-callback]
verify_jwt = false
```

## What This Fixes

- No more false failures from timeouts -- VPS has unlimited time to deliver
- `messageId` is always captured (enabling read/delivered/reaction analytics)
- The existing Tier 1 (`/message-status`) and Tier 2 (manual confirm) remain as fallbacks
- Stale recovery handles edge cases where VPS never calls back (e.g., VPS crash)

## Technical Details

### `whatsapp-send-callback` edge function structure

| Step | Action |
|------|--------|
| Auth | Validate `X-API-Key` against `WEBHOOK_SECRET_KEY` |
| Lookup | Find `notification_campaign_groups` where `group_jid` matches AND `status = 'processing'`, ordered by most recent |
| Update group | Set status to sent/failed, store messageId, clear/set error_message |
| Finalize campaign | Count remaining pending + processing groups; if zero, calculate final sent/failed counts and set campaign status |

### `process-notification-campaigns` changes

| Area | Before | After |
|------|--------|-------|
| VPS response handling | Expects `{ success, messageId }` | Expects `{ success, accepted }` |
| On success | Marks group "sent" with messageId | Leaves group in "processing" (webhook will update) |
| Campaign finalization | Finalizes after batch completes | Only finalizes if no pending/processing remain (webhook handles the rest) |
| Timeout behavior | 10s timeout = false failure | Immediate response, no timeout risk |

### Files to create/modify

| File | Action |
|------|--------|
| `supabase/functions/whatsapp-send-callback/index.ts` | Create new webhook receiver |
| `supabase/functions/process-notification-campaigns/index.ts` | Update to async send pattern |
| `supabase/config.toml` | Add `verify_jwt = false` for new function |
