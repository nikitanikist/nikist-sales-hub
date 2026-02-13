

# Update Read Receipt Webhook for LID-based Receipts

## What Already Exists
- `read_count` and `delivered_count` columns on `notification_campaign_groups`
- `notification_campaign_reads` table with deduplication
- `increment_delivered_count` RPC function
- No database or schema changes needed

## Single File Change

**File: `supabase/functions/whatsapp-read-receipt-webhook/index.ts`**

Simplify the event handling logic (lines 83-165):

1. **"delivered" events**: Always call `increment_delivered_count` RPC (atomic, capped at member_count). No reads row needed. Ignore `readerPhone` for delivered events since we only need the count.

2. **"read" events**: Require `readerPhone` (LID number). Upsert into `notification_campaign_reads` with `receipt_type = 'read'`. Then use `increment_read_count` RPC for atomic increment (same pattern as delivered).

3. **Create `increment_read_count` RPC** via migration -- same pattern as `increment_delivered_count`:
```sql
CREATE OR REPLACE FUNCTION increment_read_count(p_group_id uuid)
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE notification_campaign_groups
  SET read_count = LEAST(COALESCE(read_count, 0) + 1, COALESCE(member_count, 999999))
  WHERE id = p_group_id
  RETURNING read_count;
$$;
```

## Updated Webhook Flow

```
delivered event --> increment_delivered_count RPC --> return
read event     --> upsert to notification_campaign_reads --> increment_read_count RPC --> return
```

The old code path that counted reads via a SELECT query and then SET will be replaced with the atomic RPC approach, matching how delivered_count already works. This prevents race conditions from concurrent read receipts.

