

# Phase 5C: Workshops.tsx Component Refactoring

## Overview
Split the 1553-line `src/pages/Workshops.tsx` into 5 focused files under `src/pages/workshops/`. Purely structural -- zero functionality changes. Also delete `src/pages/Batches.tsx.bak`.

## File Structure

```text
src/pages/workshops/
  index.tsx                      -- State coordination, layout, org guards (~150 lines)
  hooks/useWorkshopsData.ts      -- All queries, mutations, realtime, constants (~350 lines)
  WorkshopFormDialog.tsx         -- Create/Edit workshop dialog with form (~280 lines)
  WorkshopTable.tsx              -- Desktop table + mobile cards + expanded rows, React.memo (~650 lines)
  WorkshopExpandedRow.tsx        -- Expanded stats/revenue/WhatsApp tabs, React.memo (~250 lines)
```

## What Goes Where

### `hooks/useWorkshopsData.ts`
- Types: `CallCategory`
- Constants: `statusColors`, `WORKSHOP_SALES_PRODUCT_ID`, `PRODUCT_PRICE`
- Queries: `workshops` (with metrics), `leads`, `funnels`, `products`
- Mutations: `createMutation`, `updateMutation`, `deleteMutation`, `createFunnelMutation`, `createProductMutation`
- Realtime subscriptions (both workshop and leads/assignments channels)
- `handleSubmit`, `handleRefresh` helpers
- `filteredWorkshops` (useMemo)
- Returns everything as a typed object

### `WorkshopFormDialog.tsx`
- The create/edit Dialog (lines 673-947): title, description, dates, location, max participants, ad spend, amount, funnel/product selects, tag select, lead select, quick actions (convert to funnel/product)
- Receives: `isOpen`, `onOpenChange`, `editingWorkshop`, form dependencies (leads, funnels, products, tags), mutations

### `WorkshopTable.tsx`
- Desktop table (lines 995-1309) and mobile card view (lines 1311-1526)
- Renders `WorkshopExpandedRow` for expanded rows
- Wrapped with `React.memo`
- Receives: workshops data, expandedRows, isManager, event handlers

### `WorkshopExpandedRow.tsx`
- The expanded content inside each row (lines 1100-1303 desktop, 1398-1521 mobile)
- Fresh calls grid, rejoin calls grid, cross-workshop info, revenue breakdown
- WhatsApp tab via `WorkshopWhatsAppTab`
- Wrapped with `React.memo`

### `index.tsx`
- UI state: `isOpen`, `editingWorkshop`, `searchQuery`, `expandedRows`, `callsDialogOpen`, `selectedWorkshopTitle`, `selectedCallCategory`, `deleteDialogOpen`, `workshopToDelete`, `selectedFunnelId`, `selectedTagId`
- Organization loading/empty state guards
- Renders: `WorkshopFormDialog`, `WorkshopTable`, `WorkshopCallsDialog`, `ConfirmDeleteDialog`

## Performance Optimizations
- `WorkshopTable` wrapped with `React.memo` -- won't re-render when dialog state changes
- `WorkshopExpandedRow` wrapped with `React.memo` -- individual expanded sections won't re-render when other rows toggle
- `filteredWorkshops` wrapped in `useMemo`

## Import Update
- Update `src/App.tsx`: change `from "./pages/Workshops"` to `from "./pages/workshops"`
- Only `src/App.tsx` imports from `./pages/Workshops` (verified)

## Safety
- Rename `src/pages/Workshops.tsx` to `src/pages/Workshops.tsx.bak` before switching imports
- Delete `.bak` file only after full testing

## Additional Cleanup
- Delete `src/pages/Batches.tsx.bak` (Phase 5B verified and passed)

## Order of Execution
1. Delete `src/pages/Batches.tsx.bak`
2. Create `src/pages/workshops/hooks/useWorkshopsData.ts`
3. Create `src/pages/workshops/WorkshopExpandedRow.tsx`
4. Create `src/pages/workshops/WorkshopTable.tsx`
5. Create `src/pages/workshops/WorkshopFormDialog.tsx`
6. Create `src/pages/workshops/index.tsx`
7. Update `src/App.tsx` import path
8. Rename old `Workshops.tsx` to `Workshops.tsx.bak`

## Testing Checklist
After the split, test every feature identically:
- Workshop list: search, create workshop, edit workshop, delete workshop
- Form: all fields (dates with timezone, funnel/product/tag/lead selects), quick actions (convert to funnel, convert to product)
- Desktop table: expand/collapse rows, navigate to workshop detail via row click or eye icon
- Expanded row: Fresh calls stats (all 8 stat cards clickable), Rejoin calls stats, Cross-workshop info, Revenue breakdown (admin only), WhatsApp tab
- Mobile card view: expand/collapse, stats grid, action buttons
- WorkshopCallsDialog: opens with correct category when stat cards are clicked
- Role-based visibility: managers should not see ad spend, P&L, revenue breakdown, or edit/delete actions

