

# Fix Reactions and Reads: UPSERT + Recount

## Changes Overview

Three areas need updating: the reactions unique constraint, the reaction webhook logic, and the read receipt webhook logic.

---

## 1. Database Migration

**Drop old unique constraint** on `notification_campaign_reactions` (currently on `campaign_group_id, reactor_phone, emoji`) and **add new one** on `(campaign_group_id, reactor_phone)` only. This means one person = one reaction per group (changing emoji overwrites the previous one).

The reads table constraint `(campaign_group_id, reader_phone, receipt_type)` is already correct -- no change needed.

---

## 2. Reaction Webhook Update

**File:** `supabase/functions/whatsapp-reaction-webhook/index.ts`

- Update the interface to accept both `reaction_add` and `reaction_remove` events
- For `reaction_add`: UPSERT with `onConflict: 'campaign_group_id,reactor_phone'` (emoji gets overwritten)
- For `reaction_remove`: DELETE the row matching `campaign_group_id + reactor_phone`
- After either operation: recount reactions from the table and update `reaction_count`

---

## 3. Read Receipt Webhook Update

**File:** `supabase/functions/whatsapp-read-receipt-webhook/index.ts`

- Replace the `increment_read_count` RPC call with a recount-from-table approach (same pattern as reactions)
- After upsert, SELECT count from `notification_campaign_reads` where `receipt_type = 'read'`, then UPDATE `read_count` on the group

This ensures the count is always accurate even if duplicate webhooks arrive.

---

## Technical Details

**Migration SQL:**
```sql
ALTER TABLE notification_campaign_reactions 
  DROP CONSTRAINT notification_campaign_reactio_campaign_group_id_reactor_pho_key;

ALTER TABLE notification_campaign_reactions 
  ADD CONSTRAINT unique_reactor_per_group 
  UNIQUE (campaign_group_id, reactor_phone);
```

**Reaction webhook key changes:**
- Interface: `event: "reaction_add" | "reaction_remove"`
- `reaction_remove` path: delete row, then recount
- `reaction_add` path: upsert with new constraint, then recount
- Validation: only require emoji for `reaction_add`, not `reaction_remove`

**Read receipt webhook key change (lines 134-142):**
Replace RPC increment with:
```typescript
const { count } = await supabase
  .from("notification_campaign_reads")
  .select("*", { count: "exact", head: true })
  .eq("campaign_group_id", campaignGroup.id)
  .eq("receipt_type", "read");

await supabase
  .from("notification_campaign_groups")
  .update({ read_count: count || 0 })
  .eq("id", campaignGroup.id);
```

