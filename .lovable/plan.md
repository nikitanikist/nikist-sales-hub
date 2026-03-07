

## Plan: Include Discontinued Students' Cash Received in Main Totals

### Problem

In `CohortPage.tsx` (which serves all cohort types — Insider Crypto Club, Future Mentorship, High Future, Wealth Club, and any future ones), the financial totals are calculated from `activeStudents` only (excluding both refunded and discontinued). This means:

- **Refunded students**: Offer amount and cash received both excluded — correct, since the money was returned.
- **Discontinued students**: Offer amount and cash received both excluded — **incorrect**. Their cash was never returned, so it should still count in the "Cash Received" total.

### Current Code (lines 464-468)

```typescript
allStudentsTotals: {
  offered: activeStudents.reduce((sum, s) => sum + (s.offer_amount || 0), 0),
  received: activeStudents.reduce((sum, s) => sum + (s.cash_received || 0), 0),
  due: nonPaeStudentsWithDue.reduce((sum, s) => sum + (s.due_amount || 0), 0),
  count: activeStudents.length,
```

All three totals come from `activeStudents`, which filters out discontinued.

### Fix

**File: `src/pages/CohortPage.tsx`**

1. **`received` total**: Add `discontinuedReceived` (already calculated at line 474) to the active students' received total. This keeps the cash we actually have.

2. **`offered` total**: Keep as-is (active students only). Discontinued students' offer amounts are correctly excluded since they are no longer committed.

3. **`due` total**: Keep as-is (active students only). Discontinued students have no remaining obligation.

4. **`count` display on the "Cash Received" card**: Show `activeStudents.length + discontinuedStudents.length` to reflect that the received amount includes cash from discontinued students too.

The change is a single line update in the `useMemo` calculation block — adding `discontinuedReceived` to the `received` field. No other files, no database changes, no schema updates.

### Scope

Since `CohortPage.tsx` is the unified page for **all** cohort types (driven by the `/cohorts/:cohortSlug` route), this fix automatically applies to every cohort batch across all organizations.

