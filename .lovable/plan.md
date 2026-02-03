

# Show Formatted Dates on Cohort Batch Cards

## What You Asked For

When clicking on **Insider Crypto Club** under the Nikist organization, show the start dates (like "03 Jan 2026") on the batch cards, similar to how Future Mentorship shows "12 Jan - 13 Jan 2026". For **High Future**, continue showing "TBD" since there are no dates available.

## Current Database State

| Cohort Type | Batch | `event_dates` | `start_date` |
|------------|-------|---------------|--------------|
| Future Mentorship | Batch 9 | "12 Jan - 13 Jan 2026" | null |
| High Future | Batch 2 (Jan) | "" (empty) | null |
| Insider Crypto Club | Batch 1 | null | 2026-01-03 |
| Insider Crypto Club | Batch 2 | null | 2026-01-19 |
| Insider Crypto Club | Batch 3 | null | 2026-02-05 |

## Solution

Update the batch card display logic to:
1. Show `event_dates` if available (like Future Mentorship)
2. If `event_dates` is empty/null but `start_date` exists, format and show the start date (like Insider Crypto Club)
3. If neither exists, show "TBD" (like High Future)

## What Will Change

| Location | Before | After |
|----------|--------|-------|
| Batch selection cards | Insider Crypto Club shows nothing | Shows "03 Jan 2026", "19 Jan 2026", "05 Feb 2026" |
| Batch selection cards | High Future shows nothing | Shows "TBD" |
| Batch detail header | Shows "Event Dates: TBD" for both | Shows formatted start_date for Insider Crypto Club, "TBD" for High Future |

## Technical Details

**File to modify:** `src/pages/CohortPage.tsx`

### Change 1: Batch Selection Card (lines 773-775)

Create a helper to compute the display date:

```typescript
const getDisplayDates = (batch: CohortBatch) => {
  if (batch.event_dates && batch.event_dates.trim()) {
    return batch.event_dates;
  }
  if (batch.start_date) {
    return format(new Date(batch.start_date), "dd MMM yyyy");
  }
  return "TBD";
};
```

Update the card to always show dates:

```tsx
<CardDescription>{getDisplayDates(batch)}</CardDescription>
```

### Change 2: Batch Detail Header (line 925)

Apply the same logic:

```tsx
<p className="text-sm text-muted-foreground">
  Event Dates: {getDisplayDates(selectedBatch)}
</p>
```

## Expected Result

**Insider Crypto Club cards will show:**
- Batch 1: "03 Jan 2026"
- Batch 2: "19 Jan 2026"
- Batch 3: "05 Feb 2026"

**High Future card will show:**
- High Future Batch 2 (Jan): "TBD"

**Future Mentorship remains unchanged:**
- Future Mentorship Batch 9: "12 Jan - 13 Jan 2026"

## Safety

- Change is isolated to display logic only
- No database modifications
- No changes to other CRM pages (Leads, Sales, Workshops)
- Existing functionality preserved

