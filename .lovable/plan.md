

# Fix: Stop Rejecting Delivered Events with Empty readerPhone

## Confirmed Root Cause

The VPS code shows:
```text
readerPhone: receipt.participant?.replace(...) || ''
```
For group "delivered" events, `receipt.participant` is undefined, so `readerPhone` is always `""`. The webhook then rejects with 400: "Missing messageId or readerPhone".

## Change

**File: `supabase/functions/whatsapp-read-receipt-webhook/index.ts`**

Update the validation block (around lines 51-59) to:
- Always require `messageId`
- Only require `readerPhone` for `"read"` events
- For `"delivered"` events with empty `readerPhone`, default to `"group"` so the upsert and unique constraint work correctly

No database or UI changes needed -- schema already supports this.

## Technical Detail

Current validation:
```text
if (!payload.messageId || !payload.readerPhone) {
  return 400
}
```

New validation:
```text
if (!payload.messageId) {
  return 400 "Missing messageId"
}

const readerPhone = payload.readerPhone || "group";
// proceed with readerPhone in upsert
```

This ensures delivered events are accepted and counted via `delivered_count`, while read events still track the specific reader phone number.
