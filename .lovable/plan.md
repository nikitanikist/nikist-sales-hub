

# Fix: Duplicate Delivered Count + Campaigns List Status Delay

## Issues Found

### 1. Delivered count overcounting (4 instead of 2-3)

The webhook logs prove duplicate events from VPS:
- Phone `226555397697686` delivered twice (at 10:51:07 and 10:51:07)
- Phone `264518462644287` delivered twice (at 10:51:06 and 10:51:08)

The `increment_delivered_count` RPC blindly adds +1 for every event. Unlike reads (which use upsert + recount for deduplication), delivered events have no deduplication.

**Fix**: Change the delivered event handler in `whatsapp-read-receipt-webhook` to use the same deduplication pattern as reads:
1. Upsert into `notification_campaign_reads` with `receipt_type: 'delivered'` (deduplicated by unique constraint on `campaign_group_id, reader_phone, receipt_type`)
2. Recount distinct delivered rows from the table
3. Direct UPDATE to `notification_campaign_groups.delivered_count` instead of using the increment RPC

### 2. Campaigns list page status stuck on "sending"

The list page has a realtime subscription but no `refetchInterval`. If the realtime event is missed or delayed, the status stays stale.

**Fix**: Add `refetchInterval` to the campaigns list query -- 5 seconds as a safety net.

## File Changes

| File | Change |
|------|--------|
| `supabase/functions/whatsapp-read-receipt-webhook/index.ts` | Replace `increment_delivered_count` RPC with upsert + recount pattern (matching reads) |
| `src/pages/whatsapp/Campaigns.tsx` | Add `refetchInterval: 5000` to campaigns query |

## Technical Details

### Webhook change (delivered handler)

Replace lines 90-108 in `whatsapp-read-receipt-webhook/index.ts`:

```typescript
// DELIVERED events: deduplicate via upsert, then recount
if (payload.event === "delivered") {
  if (!payload.readerPhone) {
    // No phone = can't deduplicate, skip
    return new Response(
      JSON.stringify({ message: "Skipped: no readerPhone for delivered" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Upsert (deduplicated by unique constraint)
  await supabase
    .from("notification_campaign_reads")
    .upsert(
      {
        campaign_group_id: campaignGroup.id,
        reader_phone: payload.readerPhone,
        read_at: payload.timestamp || new Date().toISOString(),
        receipt_type: "delivered",
      },
      { onConflict: "campaign_group_id,reader_phone,receipt_type" }
    );

  // Recount for accuracy
  const { count } = await supabase
    .from("notification_campaign_reads")
    .select("*", { count: "exact", head: true })
    .eq("campaign_group_id", campaignGroup.id)
    .eq("receipt_type", "delivered");

  await supabase
    .from("notification_campaign_groups")
    .update({ delivered_count: count || 0 })
    .eq("id", campaignGroup.id);

  return new Response(
    JSON.stringify({ success: true, receipt_type: "delivered", count }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

### Campaigns list query change

Add refetchInterval to the query at line 60-73 in `Campaigns.tsx`:

```typescript
refetchInterval: 5000,
```

This ensures even if realtime misses an update, the list refreshes within 5 seconds.
