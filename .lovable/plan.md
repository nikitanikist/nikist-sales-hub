
# UI Improvement: Campaign Analytics Labels and Freshness Indicator

## Summary
Two changes to the Campaign Detail page to make the analytics clearer and more transparent.

## Change 1: Rename "Delivered" to "Not Yet Read"

Since the current "Delivered" count only shows people who received the message but have NOT opened it, the label is misleading. Renaming it to "Not Yet Read" makes the meaning immediately obvious.

**File:** `src/pages/whatsapp/CampaignDetail.tsx`

- Stat card label: "Delivered" becomes "Not Yet Read"
- Table column header: "Delivered" becomes "Not Yet Read"
- Icon stays the same (CheckCheck) but could optionally change to a more fitting one like `EyeOff`

## Change 2: Add "Last Updated" Timestamp

Add a small, subtle timestamp below the stats grid that shows when the data was last refreshed. This updates automatically whenever the React Query refetch fires (every 5 seconds during sending, every 30 seconds otherwise) or when a real-time event arrives.

**File:** `src/pages/whatsapp/CampaignDetail.tsx`

- Use the `dataUpdatedAt` property from the React Query result (already available from `useQuery`)
- Display it as: "Last updated: 2 min ago" or "Last updated: just now"
- Format the relative time using `date-fns` (already installed)
- Place it below the stats grid, near the existing "receipts may take a few minutes" info banner

**Example UI:**
```
[Stats Grid Cards]
Last updated: just now                    (clock icon, muted text, small font)
```

## No Backend Changes
- No database or edge function modifications
- The underlying data remains the same; only labels and display change
