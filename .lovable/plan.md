

# Fix: Accept Both "read" and "delivered" Events in WhatsApp Receipt Webhook

## Problem

The VPS sends two types of receipt events: `"read"` and `"delivered"`. Currently, the webhook only types the payload as `event: "read"` and doesn't validate or handle `"delivered"` events. While it doesn't explicitly reject them with a 400, the lack of separate tracking means delivered events are silently mixed into read counts. More importantly, for group chats, `"delivered"` is often the best metric available since WhatsApp limits read receipts for privacy.

## Solution

Track read and delivered events **separately** by adding a `delivered_count` column to the database and a `receipt_type` column to the reads table. This gives the best analytics visibility.

## Changes

### 1. Database Migration

- Add `delivered_count` integer column (default 0) to `notification_campaign_groups`
- Add `receipt_type` text column (default `'read'`) to `notification_campaign_reads` with a check for `'read'` or `'delivered'`
- Update the unique constraint on `notification_campaign_reads` to include `receipt_type` so the same phone can have both a read and delivered entry

### 2. Edge Function: `whatsapp-read-receipt-webhook/index.ts`

- Update the `ReadReceiptPayload` interface to accept `event: "read" | "delivered"`
- Add validation: reject events that are neither `"read"` nor `"delivered"`
- Store the `receipt_type` in the upsert
- Update the correct denormalized counter: `read_count` for "read" events, `delivered_count` for "delivered" events

### 3. UI: `src/pages/whatsapp/CampaignDetail.tsx`

- Add a "Delivered" stats card alongside the existing "Read" card
- Add a `delivered_count` column to the per-group table
- Compute `totalDelivered` the same way `totalReads` is computed

## Technical Details

```text
notification_campaign_groups
+------------------+
| ...existing...   |
| read_count       |  (already exists)
| delivered_count  |  (new, default 0)
+------------------+

notification_campaign_reads
+--------------------+
| ...existing...     |
| receipt_type       |  (new: 'read' or 'delivered')
+--------------------+
unique on (campaign_group_id, reader_phone, receipt_type)
```

The webhook logic change:

```text
1. Parse payload, validate event is "read" or "delivered"
2. Upsert into notification_campaign_reads with receipt_type
3. Count rows matching that receipt_type for the group
4. Update the corresponding counter (read_count or delivered_count)
```

