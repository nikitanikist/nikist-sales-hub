
# Restore Missing Features in Unified Cohort Batch Detail View

## Problem Summary
The new unified `CohortPage.tsx` that was created for the cohort system is missing most of the rich functionality that existed in the legacy `HighFuture.tsx` and `FuturesMentorship.tsx` pages. Specifically:

**Missing UI Features:**
1. Action menu (three-dot dropdown) for each student row with:
   - Update EMI
   - Edit Notes
   - Mark as Refunded
   - Mark as Discontinued
   - Delete Student (Admin only)
2. Interactive summary filter cards (Refunded, Discontinued, Full Payment, Due Remaining, Today's Follow-up, Pay After Earning)
3. Closer breakdown in financial cards showing revenue by salesperson
4. Add Student button and dialog
5. Notes indicator icon on student rows
6. PAE (Pay After Earning) badge on student names
7. Expandable EMI payment history with Edit/Delete actions
8. Export to CSV functionality
9. Many dialogs (Update EMI, Add Student, Refund, Discontinued, Notes, View Notes)

**Current CohortPage has:**
- Basic summary cards (Total Students, Offered, Received, Due)
- Simple student table with no actions
- Tabs for Students/Overview/Insights
- Basic filtering in a Sheet

## Solution Overview
Port all the missing features from `HighFuture.tsx` to `CohortPage.tsx` while adapting them to work with the unified `cohort_students`, `cohort_emi_payments`, and `cohort_offer_amount_history` tables.

## Implementation Plan

### Phase 1: Add Missing State and Imports
- Import additional dialog components and create new unified ones if needed
- Add all missing state variables for:
  - EMI student dialog state
  - Add student dialog state  
  - Refund dialog state
  - Discontinued dialog state
  - Notes dialog state
  - View notes dialog state
  - Delete student dialog state

### Phase 2: Create Unified Dialog Components
Since the existing dialogs (`UpdateHighFutureEmiDialog`, `AddHighFutureStudentDialog`) are tied to the legacy `high_future_*` tables, we need to either:
- **Option A**: Create new unified versions that work with `cohort_*` tables
- **Option B**: Make the existing dialogs configurable to work with different table schemas

**Recommended: Option A** - Create new components:
- `AddCohortStudentDialog.tsx` - For adding students to any cohort batch
- `UpdateCohortEmiDialog.tsx` - For managing EMI payments on cohort_emi_payments table

### Phase 3: Add Interactive Summary Filter Cards
Restore the clickable filter cards that were in HighFuture.tsx:
- Row 1: Financial cards with closer breakdown (Total Offered, Cash Received, Due Amount)
- Row 2: Status filter cards:
  - Refunded count
  - Discontinued count  
  - Full Payment count
  - Due Remaining amount (with student count)
  - Today's Follow-ups
  - Pay After Earning amount

### Phase 4: Enhance Students Table
Update the student table to include:
- Expand/collapse chevron column
- Conversion date column
- PAE badge on student name
- Notes/follow-up indicator icon
- Closer name column
- Actions dropdown menu (Update EMI, Edit Notes, Mark Refunded, Discontinued, Delete)

### Phase 5: Add Expanded Row with EMI History
When a student row is clicked:
- Show expandable section with EMI payment history table
- Include columns: EMI #, Amount, Date, Platform, GST, Fees, Remarks, Updated By
- Add Edit and Delete actions for each EMI record

### Phase 6: Add All Missing Dialogs
Implement or wire up:
1. **Update EMI Dialog** - New `UpdateCohortEmiDialog` component
2. **Add Student Dialog** - New `AddCohortStudentDialog` component
3. **Refund Dialog** - AlertDialog for marking as refunded
4. **Discontinued Dialog** - AlertDialog for marking as discontinued
5. **Notes Dialog** - Dialog for editing notes + follow-up date + PAE toggle
6. **View Notes Dialog** - Read-only view of notes with Edit button
7. **Delete Student Dialog** - Admin-only AlertDialog for permanent deletion

### Phase 7: Add Mutations
Add missing mutations for:
- Refund student (update status + refund_reason)
- Discontinue student (update status)
- Update notes/follow-up/PAE
- Delete student (admin only)
- Export CSV functionality

---

## Technical Details

### New Files to Create
1. `src/components/AddCohortStudentDialog.tsx` (based on AddHighFutureStudentDialog)
2. `src/components/UpdateCohortEmiDialog.tsx` (based on UpdateHighFutureEmiDialog)

### Files to Modify
1. `src/pages/CohortPage.tsx` - Major enhancements (approximately 800+ lines to add)

### Database Tables Used
- `cohort_students` - Student records
- `cohort_emi_payments` - EMI payment history
- `cohort_offer_amount_history` - Offer amount change tracking
- `leads` - For student name/contact info (via lead_id)
- `profiles` - For closer names and created_by names

### Key Additions to CohortPage.tsx
```text
State additions:
- emiStudent, addStudentOpen, refundingStudent, refundNotes
- discontinuingStudent, deletingStudent, viewingNotesStudent
- closerBreakdown calculation

Mutations to add:
- refundMutation, discontinueMutation, deleteStudentMutation, notesMutation

UI sections to add:
- Row 1: Financial cards with closer breakdown (3 cards)
- Row 2: Interactive filter cards (6 cards)
- Enhanced table with actions dropdown
- Expanded row EMI table
- All 7 dialogs listed above
```

### Estimated Changes
- New dialog components: ~1,300 lines total
- CohortPage.tsx enhancements: ~800 additional lines
- Total new/modified code: ~2,100 lines
