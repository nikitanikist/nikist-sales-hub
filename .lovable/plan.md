
# Fix: Cohort Navigation Not Resetting When Switching Cohort Types

## Issue Confirmed

When navigating between cohort types in the sidebar (e.g., "Hi Future" → "Future Mentorship" → "Insider Crypto Club"), the page heading changes correctly but the content remains stuck on the previously selected batch. This creates a confusing experience where users see mismatched data.

**Organization affected:** Nikist (`00000000-0000-0000-0000-000000000001`)

---

## Root Cause

The `CohortPage` component (located at `src/pages/CohortPage.tsx`) uses React's `useState` to track which batch is currently selected. When navigating between cohort types:

1. The URL changes (e.g., `/cohorts/high-future` → `/cohorts/futures-mentorship`)
2. The `cohortSlug` parameter updates
3. The page heading updates (this comes from AppLayout, which reads the current route)
4. **BUT** the internal `selectedBatch` state does NOT reset because React Router reuses the same component instance

This is a well-known React Router behavior—when the same component handles multiple route variations, state persists unless explicitly cleared.

---

## Solution

Add a `useEffect` hook in `CohortPage.tsx` that watches for changes to `cohortSlug` and resets all internal state to defaults when the cohort type changes.

---

## Scope of Changes

| File | Change | Risk |
|------|--------|------|
| `src/pages/CohortPage.tsx` | Add `useEffect` to reset state on `cohortSlug` change | **Very Low** |

**Why this is safe:**
- This change is isolated to a single component
- It only affects what happens when the URL slug changes
- It does not modify any database queries, RLS policies, or backend logic
- It does not change how data is fetched—only when state resets
- Other pages in the CRM (Leads, Sales, Workshops, etc.) are completely unaffected

---

## Technical Implementation

### Step 1: Update Import Statement

Add `useEffect` to the existing React import on line 1.

**Before:**
```typescript
import React, { useState, useMemo } from "react";
```

**After:**
```typescript
import React, { useState, useMemo, useEffect } from "react";
```

### Step 2: Add State Reset Hook

Add a new `useEffect` block after line 144 (after all state declarations, before the data fetching queries):

```typescript
// Reset all state when navigating to a different cohort type
useEffect(() => {
  // Clear batch selection - returns user to batch card view
  setSelectedBatch(null);
  setExpandedStudentId(null);
  
  // Clear search queries
  setSearchQuery("");
  setBatchSearchQuery("");
  
  // Reset to default tab
  setActiveTab("students");
  
  // Close and reset filters
  setIsFilterOpen(false);
  setDateFrom(undefined);
  setDateTo(undefined);
  setStatusFilter("all");
  setFilterRefunded(false);
  setFilterDiscontinued(false);
  setFilterFullPayment(false);
  setFilterRemaining(false);
  setFilterTodayFollowUp(false);
  setFilterPAE(false);
  
  // Clear any open dialogs/modals
  setNotesStudent(null);
  setEmiStudent(null);
  setAddStudentOpen(false);
  setRefundingStudent(null);
  setDiscontinuingStudent(null);
  setDeletingStudent(null);
  setViewingNotesStudent(null);
}, [cohortSlug]);
```

---

## What This Fixes

| Behavior | Before | After |
|----------|--------|-------|
| Click "Future Mentorship" while viewing Hi Future batch | Heading changes, but Hi Future students stay on screen | Shows Future Mentorship batch selection cards |
| Filters from previous cohort | Carry over and may hide data | Reset to defaults |
| Search query from previous cohort | Stays active, potentially showing "no results" | Cleared |
| Selected tab (Students/Insights) | Stays on previous selection | Resets to "Students" |

---

## Testing Checklist

After implementation, verify on Nikist organization:

1. Go to "Hi Future" and select a batch to view students
2. Click on "Future Mentorship" in sidebar
3. **Expected:** See batch selection cards for Future Mentorship, not Hi Future students
4. Select a batch in Future Mentorship
5. Apply a filter (e.g., "Show refunded only")
6. Click on "Insider Crypto Club" in sidebar
7. **Expected:** Filters should be cleared, batch selection cards should appear
8. Verify existing functionality still works:
   - Adding students to a batch
   - Updating EMI payments
   - Using filters within a cohort
   - The Insights tab
