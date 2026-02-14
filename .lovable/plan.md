

# Phase 5B: Batches.tsx Component Refactoring

## Overview
Split the 2635-line `src/pages/Batches.tsx` into 8 focused files under `src/pages/batches/`. Purely structural -- zero functionality changes.

## File Structure

```text
src/pages/batches/
  index.tsx                    -- Main layout, state coordination, two views (list vs detail) (~300 lines)
  BatchListView.tsx            -- Batches list table + search + create/edit/delete batch dialogs (~250 lines)
  BatchDetailHeader.tsx        -- Back button, batch info, add student button, student count card (~80 lines)
  BatchStudentsTab.tsx         -- Summary cards, filter sheet, search bar, student table with React.memo (~700 lines)
  BatchStudentRow.tsx          -- Single student table row + expanded EMI section with React.memo (~250 lines)
  BatchDialogs.tsx             -- Transfer, Refund, Notes, View Notes, Discontinued, Delete Student dialogs (~400 lines)
  hooks/useBatchesData.ts      -- All useQuery + useMutation hooks (~350 lines)
  hooks/useBatchFilters.ts     -- Filter state, filteredStudents, closerBreakdown, totals, export logic (~250 lines)
```

## What Goes Where

### `hooks/useBatchesData.ts`
- Interfaces: `Batch`, `BatchStudent`, `EmiPayment`
- Constant: `CLASSES_ACCESS_LABELS`
- Queries: `batches`, `batchStudents`, `studentEmiPayments`, `batchEmiPayments`
- Mutations: `createMutation`, `updateMutation`, `deleteMutation`, `transferMutation`, `markRefundedMutation`, `updateNotesMutation`, `markDiscontinuedMutation`, `deleteStudentMutation`
- Helper functions: `handleCloseForm`, `handleOpenEdit`, `handleSubmit`, `handleTransferStudent`, `handleBackToBatches`
- Form state: `formName`, `formStartDate`, `formIsActive`, `isDatePopoverOpen`
- Returns everything as a typed object

### `hooks/useBatchFilters.ts`
- All filter useState declarations (lines 126-139)
- `uniqueClosers`, `uniqueClasses` (useMemo)
- `filteredStudents` (useMemo -- the big filter logic, lines 328-419)
- `filteredBatches` (useMemo)
- `allStudentsTotals` (useMemo)
- `closerBreakdown`, `totals`, `refundedBreakdown`, etc. (useMemo)
- `activeFilterCount` (useMemo)
- `clearAllFilters` function
- `toggleCloser`, `toggleClass` helpers
- `handleExportStudents` function

### `BatchListView.tsx`
- Batches list table (lines 2420-2604): PageIntro, create/edit batch dialog, search, table of batches, delete batch dialog
- Receives batches data, mutations, form state as props

### `BatchDetailHeader.tsx`
- Back button, batch name/info, Add Student button, Students count card (lines 980-1021)
- Simple presentational component

### `BatchStudentsTab.tsx`
- The "Students" TabsContent (lines 1089-2048): summary cards, filter sheet, search bar, active filters display, and the student table
- Wrapped with `React.memo`
- Renders `BatchStudentRow` for each student

### `BatchStudentRow.tsx`
- Single student row rendering (lines 1777-2041): main row cells + expanded EMI detail section
- Wrapped with `React.memo` to prevent re-renders when other students expand/collapse
- Receives student data, role flags, handlers as props

### `BatchDialogs.tsx`
- Transfer Student dialog (lines 2050-2088)
- Mark as Refunded dialog (lines 2091-2143)
- Notes dialog (lines 2145-2239)
- View Notes dialog (lines 2242-2295)
- Mark as Discontinued dialog (lines 2297-2350)
- Delete Student dialog (lines 2606-2629)
- UpdateEmiDialog + AddBatchStudentDialog wrappers (lines 2352-2384)

### `index.tsx`
- Remaining UI state: `selectedBatch`, `expandedStudentId`, dialog open states, insights tab state, student list dialog state
- Imports and wires up all sub-components
- Organization loading/empty state guards
- Two main render paths: batch list view vs batch detail view
- Batch detail view renders: `BatchDetailHeader`, `Tabs` (Overview, Insights, Students), `BatchDialogs`, `StudentListDialog`

## Performance Optimizations
- `BatchStudentsTab` wrapped with `React.memo` -- won't re-render when dialog state changes
- `BatchStudentRow` wrapped with `React.memo` -- individual rows won't re-render when other rows expand
- All filtering/grouping/totals logic already in `useMemo`, stays that way in `useBatchFilters`

## Import Update
- Update `src/App.tsx` line 23: change `from "./pages/Batches"` to `from "./pages/batches"`
- Only `src/App.tsx` imports from `./pages/Batches` (verified via search)

## Safety
- Rename `src/pages/Batches.tsx` to `src/pages/Batches.tsx.bak` before switching imports
- Delete `.bak` file only after full testing

## Order of Execution
1. Create `src/pages/batches/hooks/useBatchesData.ts`
2. Create `src/pages/batches/hooks/useBatchFilters.ts`
3. Create `src/pages/batches/BatchStudentRow.tsx`
4. Create `src/pages/batches/BatchStudentsTab.tsx`
5. Create `src/pages/batches/BatchDetailHeader.tsx`
6. Create `src/pages/batches/BatchListView.tsx`
7. Create `src/pages/batches/BatchDialogs.tsx`
8. Create `src/pages/batches/index.tsx`
9. Update `src/App.tsx` import path
10. Rename old `Batches.tsx` to `Batches.tsx.bak`

## Testing Checklist
After the split, test every feature identically:
- Batch list: search batches, create batch, edit batch, delete batch
- Batch detail: Overview tab (calendar, action cards), Insights tab (aging table), Students tab
- Students tab: search, all filters (closer, classes, date range, payment type, today follow-up, refunded, discontinued, full payment, remaining, PAE)
- Student actions: expand EMI history, change batch, mark refunded, mark discontinued, add/edit notes with follow-up date and PAE toggle, view notes, update EMI, delete student (admin)
- Export CSV (admin vs manager view)
- Add student dialog
- Student list dialog from insights
- Mobile responsiveness

