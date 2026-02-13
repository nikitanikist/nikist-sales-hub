

# Deduplicate Delivered Receipts by Capping at Member Count

## Problem

The current increment logic (lines 86-102) has two issues:
1. **No deduplication** -- the same delivery event sent from multiple VPS sessions (or retried by WhatsApp) increments the counter each time.
2. **Race condition** -- concurrent webhooks read the same `delivered_count`, both write `count + 1`, resulting in a lost update.

## Approach: Atomic SQL increment with a cap

Instead of read-then-write in application code, use a single atomic SQL update that increments `delivered_count` but never exceeds `member_count`. This is handled entirely on the CRM side -- no VPS changes needed.

## Changes

**File: `supabase/functions/whatsapp-read-receipt-webhook/index.ts`**

Replace the current delivered-no-reader block (lines 86-102) with an RPC call to a new database function that atomically increments `delivered_count` only if it is below `member_count`.

**Database migration: new function `increment_delivered_count`**

```sql
CREATE OR REPLACE FUNCTION public.increment_delivered_count(p_group_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE notification_campaign_groups
  SET delivered_count = LEAST(COALESCE(delivered_count, 0) + 1, COALESCE(member_count, 999999))
  WHERE id = p_group_id
  RETURNING delivered_count;
$$;
```

This single statement is atomic (no race condition) and caps at member_count (no over-counting from duplicate webhooks).

**Edge function update (delivered branch):**

```text
// Replace lines 86-102 with:
const { data, error } = await supabase.rpc('increment_delivered_count', { p_group_id: campaignGroup.id });
const newCount = data;
// Log and return response
```

## Why this approach

- **Atomic** -- single SQL statement, no read-then-write race
- **Capped** -- delivered_count can never exceed member_count
- **No VPS changes** -- handled entirely in CRM
- **Simple** -- one small DB function, minimal edge function change
- **No timing hacks** -- works regardless of how many times the same event arrives

