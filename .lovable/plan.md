

# UX Improvement: Loading States for Delivery & Read Analytics

## What Changes

When a campaign has been sent (status is "completed" or "sending") but the delivered/read/reaction counts are still 0, show a subtle loading shimmer with a "Fetching..." label instead of a plain "0". Also add a small info banner below the stats grid explaining the delay.

## Detailed Changes

### File: `src/pages/whatsapp/CampaignDetail.tsx`

**1. Detect "awaiting receipts" state**

Add a helper that checks if the campaign is recently completed/sending AND a count is still 0:

```typescript
const isRecentlySent = campaign.status === "sending" || campaign.status === "completed";
const isAwaitingDelivery = isRecentlySent && totalDelivered === 0 && sentCount > 0;
const isAwaitingReads = isRecentlySent && totalReads === 0 && sentCount > 0;
const isAwaitingReactions = isRecentlySent && totalReactions === 0 && sentCount > 0;
```

**2. Update stat cards for Delivered, Read, and Reactions**

When the corresponding "awaiting" flag is true, replace the "0" value with a small animated shimmer bar and the label "Fetching..." in place of the number. Once the count becomes > 0, show the actual number as it does today.

For the stat items array, change the `value` for Delivered/Read/Reactions:
- If awaiting: render a pulsing skeleton placeholder (e.g., `<Skeleton className="h-7 w-12 rounded" />`) with text "Fetching..." below
- Otherwise: show the number as-is

**3. Add info banner below stats grid**

When any of the three "awaiting" flags are true, show a small muted banner:

```
"Delivery and read receipts may take a few minutes to update after sending."
```

Styled as a subtle `text-xs text-muted-foreground` line with a Clock icon, placed between the stats grid and the groups table.

**4. Update table cells for Delivered/Read/Reactions columns**

When a group row has `status === "sent"` and `delivered_count === 0`, show a small pulsing dot or "..." instead of the dash, indicating data is still incoming. Once count > 0, show the number as today.

## No Backend Changes Required

This is purely a frontend UX improvement -- no database, webhook, or edge function changes needed.
