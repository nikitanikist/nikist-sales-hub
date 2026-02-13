

# Filter Community Parents from Sync and Handle Async WhatsApp Errors

## 1. Delete the two bad community parent groups

Run a SQL data operation to remove the two known community container groups that cause error 420:

```sql
DELETE FROM whatsapp_groups 
WHERE group_jid IN ('120363407711548023@g.us', '120363405870946081@g.us');
```

## 2. Update VPS sync to skip community parents entirely

**File: `supabase/functions/vps-whatsapp-proxy/index.ts`**

Add a `.filter()` before `.map()` at line ~804 so community parent groups are never stored:

```text
const groupsToUpsert = vpsGroups
  .filter((g: any) => g.isCommunity !== true)
  .map((g: any) => { ... });
```

This prevents community parents from re-appearing after future syncs. Announcement groups (`isCommunityAnnounce: true`) are still synced since they are the actual sendable targets.

## 3. Create `whatsapp-message-error-webhook` edge function

**New file: `supabase/functions/whatsapp-message-error-webhook/index.ts`**

This webhook receives async error ACKs from the VPS when WhatsApp rejects a message after the initial send succeeded (e.g., error 420).

Expected payload from VPS:
```json
{
  "event": "message_error",
  "sessionId": "wa_xxx",
  "messageId": "ABCDEF...",
  "errorCode": 420,
  "errorMessage": "Rate limit / community parent rejection",
  "groupJid": "120363407711548023@g.us"
}
```

Logic:
1. Authenticate with same API key (`nikist-whatsapp-2024-secure-key`)
2. Look up `notification_campaign_groups` by `message_id`
3. Update status from `sent` to `failed` with `error_message` = the error details
4. Recount sent/failed totals on the parent `notification_campaigns` row and update status to `partial_failure` if needed

**Config: `supabase/config.toml`**
```toml
[functions.whatsapp-message-error-webhook]
verify_jwt = false
```

## Technical Details

- The VPS side will need a corresponding change to forward error ACKs to this new webhook URL. That is outside the CRM codebase but the endpoint will be ready.
- The `is_community` filter in sync is a hard filter (not just a flag) so community parents will no longer clutter the database at all.
- The `is_community` and `is_community_announce` columns remain on the table for any edge cases but community parents simply won't be synced.

## Sequence

1. Delete the two bad groups (data operation)
2. Update VPS proxy sync to filter out community parents
3. Create the error webhook edge function + config.toml entry
4. Deploy both edge functions

