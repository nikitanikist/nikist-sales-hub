

# Fix Workshop Notification Page Issues

## Overview

This plan addresses three bugs on the Workshop Notification page:

1. **Date Display Issue** - Workshop shows Feb 1 instead of Jan 31
2. **Dropdown Cropping** - WhatsApp group dropdown is cropped/going upward
3. **Group Selection Not Updating** - Shows "No group" after successful save

---

## Issue 1: Date Display Shows Wrong Day

### Root Cause

The workshop "Test workshop" is stored in the database as `2026-01-31 20:02:00+00` (UTC). When displayed, the code uses:

```typescript
const workshopDate = new Date(workshop.start_date);
format(workshopDate, 'MMM d, yyyy')
```

The user is likely in IST (UTC+5:30). When JavaScript parses the UTC timestamp, it converts to local time:
- Jan 31, 20:02 UTC → Feb 1, 01:32 IST

This causes the date to display as Feb 1 instead of Jan 31.

### Solution

Use `parseISO` from date-fns with timezone-aware formatting, or parse the date in a way that preserves the intended date. Since workshops are typically scheduled for a specific local date/time, we should display the date portion without timezone conversion.

**File to modify:** `src/components/operations/WorkshopDetailSheet.tsx` and `src/pages/operations/WorkshopNotification.tsx`

**Technical Change:**
Replace:
```typescript
const workshopDate = new Date(workshop.start_date);
```

With:
```typescript
import { parseISO } from 'date-fns';
// Use parseISO which handles ISO strings correctly
const workshopDate = parseISO(workshop.start_date);
```

Additionally, for the table display, extract just the date portion to avoid timezone shifts:
```typescript
// Extract just the date part (YYYY-MM-DD) to prevent timezone shifting
const dateOnly = workshop.start_date.split('T')[0];
const workshopDate = new Date(dateOnly + 'T00:00:00');
```

---

## Issue 2: Dropdown Getting Cropped (Going Upward)

### Root Cause

The Sheet component has `overflow-y-auto` on the content, but the SelectContent dropdown uses Radix's Popper which positions itself relative to the viewport. When there's limited space below, it flips upward but gets clipped by the sheet's overflow container.

### Solution

Add the `position="popper"` prop with `side="bottom"` to force the dropdown to position correctly within the scrollable container, and ensure proper z-index stacking.

**File to modify:** `src/components/operations/WorkshopDetailSheet.tsx`

**Technical Change:**
Update all SelectContent components with:
```tsx
<SelectContent 
  position="popper" 
  side="bottom" 
  align="start"
  className="z-[100]"
>
```

This ensures dropdowns:
1. Open downward (preferred)
2. Use proper positioning within the container
3. Have a high z-index to stay above other elements

---

## Issue 3: Group Selection Shows "No group" After Save

### Root Cause

When the user selects a group:
1. `updateGroup` mutation is called → saves to database
2. Mutation succeeds → toast shows "WhatsApp group linked"
3. Query cache is invalidated
4. BUT the `selectedWorkshop` state in WorkshopNotification.tsx is NOT updated

The sheet is displaying data from the stale `selectedWorkshop` state, not the fresh data from the query.

### Solution

Update the `selectedWorkshop` state when the underlying data changes, or use the workshop data directly from the query results.

**File to modify:** `src/pages/operations/WorkshopNotification.tsx`

**Technical Change:**
Add an effect to sync the selected workshop with the latest data from the query:

```typescript
// Keep selectedWorkshop in sync with fresh query data
useEffect(() => {
  if (selectedWorkshop && workshops.length > 0) {
    const freshWorkshop = workshops.find(w => w.id === selectedWorkshop.id);
    if (freshWorkshop && freshWorkshop !== selectedWorkshop) {
      setSelectedWorkshop(freshWorkshop);
    }
  }
}, [workshops, selectedWorkshop]);
```

This ensures when the query data updates after a mutation, the sheet displays the fresh data including the newly linked WhatsApp group.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/operations/WorkshopDetailSheet.tsx` | Fix date parsing, fix dropdown positioning |
| `src/pages/operations/WorkshopNotification.tsx` | Fix date parsing, sync selected workshop state |

---

## Technical Details

### WorkshopDetailSheet.tsx Changes

1. Add `parseISO` import from date-fns
2. Change date parsing:
   ```typescript
   // Before
   const workshopDate = new Date(workshop.start_date);
   
   // After - extract date portion to avoid timezone shift
   const datePart = workshop.start_date.split('T')[0];
   const workshopDate = new Date(datePart + 'T12:00:00');
   ```

3. Update all three SelectContent components (Tag, Account, Group) with:
   ```tsx
   <SelectContent 
     position="popper" 
     side="bottom" 
     align="start"
     sideOffset={4}
   >
   ```

### WorkshopNotification.tsx Changes

1. Fix date display in table (same approach)
2. Add effect to sync selectedWorkshop:
   ```typescript
   useEffect(() => {
     if (selectedWorkshop && workshops.length > 0) {
       const freshData = workshops.find(w => w.id === selectedWorkshop.id);
       if (freshData) {
         setSelectedWorkshop(freshData);
       }
     }
   }, [workshops]);
   ```

---

## Expected Results After Fix

1. **Date Display**: Workshop dates will show the correct date regardless of user's timezone (Jan 31 will show as Jan 31)

2. **Dropdown Position**: WhatsApp group dropdown will open downward properly without being cropped

3. **Group Selection**: After selecting a group, the dropdown will immediately show the selected group name instead of "No group"

---

## Testing Checklist

- Workshop created on Jan 31 displays as Jan 31 (not Feb 1)
- WhatsApp group dropdown opens downward and is fully visible
- After selecting a group, the UI updates to show the selected group
- All three issues work on both desktop and mobile views

