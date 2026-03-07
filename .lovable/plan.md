

## Corrected Plan: Add "Update Offer Amount" and "Closer" Dropdown to Cohort EMI Dialogs

### What I Found

After reviewing all dialog files:

- **`UpdateEmiDialog.tsx`** (Sales Closers): Has the amber-bordered "UPDATE OFFER AMOUNT" card with "Edit Offer" / "Cancel" buttons -- this is the screenshot reference.
- **`UpdateFuturesEmiDialog.tsx`** and **`UpdateHighFutureEmiDialog.tsx`**: Already have the identical amber-bordered "UPDATE OFFER AMOUNT" section in the code (lines 521-557). You should be seeing this when you open "Update EMI" from the three-dot menu. If it is not visible, it may be a rendering or data issue we can investigate after implementation.
- **`UpdateCohortEmiDialog.tsx`**: Only has the subtle inline click-to-edit (click the amount number at the top to edit). No amber card, no "Edit Offer" button. This is the one that needs the upgrade.

None of the three cohort dialogs have a "Closer" dropdown.

---

### Changes

**File 1: `src/components/UpdateCohortEmiDialog.tsx`**
1. **Replace** the inline click-to-edit offer amount (lines 484-508) with the amber-bordered "UPDATE OFFER AMOUNT" card (matching `UpdateEmiDialog.tsx` pattern: amber bg, "Edit Offer"/"Cancel" buttons, current amount display, new amount input, recalculated due, warning)
2. **Add** Offer Amount History table below the card (query `cohort_offer_amount_history`)
3. **Add** a "Closer" select dropdown after the Payment Platform field (line 644), using `useOrgClosers` hook
4. **Add** `closerId` prop to the interface; on save, update `cohort_students.closer_id`
5. **Add** role check via `useUserRole` -- only show offer amount section and closer dropdown for `admin` / `manager`

**File 2: `src/components/UpdateFuturesEmiDialog.tsx`**
1. **Add** "Closer" select dropdown after Payment Platform
2. **Add** `closerId` prop; update `futures_students.closer_id` on save
3. **Add** role check for offer amount section and closer dropdown (admin/manager only)

**File 3: `src/components/UpdateHighFutureEmiDialog.tsx`**
1. Same changes as Futures dialog

**Parent files** (pass `closerId` prop to each dialog):
- `src/pages/CohortPage.tsx`
- `src/pages/futures-mentorship/FuturesDialogs.tsx` or equivalent
- `src/pages/HighFuture.tsx`

### No database migrations needed
`closer_id` already exists on `cohort_students`. The `useOrgClosers` hook already exists and fetches all closers for the org.

