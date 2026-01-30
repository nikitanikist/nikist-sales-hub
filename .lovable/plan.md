
# Update All Date/Time Operations to Use Organization Timezone

## Overview

This plan will ensure **every** date and time displayed or calculated in the portal uses the organization's configured timezone (currently set to India IST) instead of the browser's local timezone.

---

## Current Status

| Area | Timezone Used |
|------|---------------|
| Workshop Notifications | Organization timezone (correct) |
| Workshop Detail Sheet | Organization timezone (correct) |
| Message Checkpoints | Organization timezone (correct) |
| Settings Page | Organization timezone (correct) |
| All Other Pages | Browser timezone (needs update) |

---

## Files Requiring Updates

### High Priority - User-Facing Dates

| File | Lines | Current Code | Change Needed |
|------|-------|--------------|---------------|
| `src/pages/Workshops.tsx` | 964, 1255+ | `format(new Date(workshop.start_date), "MMM dd, yyyy")` | Use `formatInOrgTime` |
| `src/pages/Batches.tsx` | 987, 2540, 2069, 2545-2547 | `format(new Date(batch.start_date), ...)` | Use `formatInOrgTime` |
| `src/pages/DailyMoneyFlow.tsx` | 151-164, 219-278 | `format(new Date(), "yyyy-MM-dd")` | Use org timezone for "today" |
| `src/pages/Calls.tsx` | 69-83, 462 | Date filter logic uses `new Date()` | Use org timezone |
| `src/pages/CloserAssignedCalls.tsx` | 72-77, 180-232 | Call time checks use browser time | Use org timezone |

### Medium Priority - Form Inputs

| File | Lines | Change Needed |
|------|-------|---------------|
| `src/components/ScheduleCallDialog.tsx` | 116-117 | Format scheduled date in org timezone |
| `src/components/RebookCallDialog.tsx` | 95-96, 129 | Format dates in org timezone |
| `src/components/ReassignCallDialog.tsx` | 328 | Date selection logic |
| `src/components/AddMoneyFlowDialog.tsx` | 56-59 | Today/yesterday logic |

### Lower Priority - Display Only

| File | Change Needed |
|------|---------------|
| `src/pages/settings/WhatsAppConnection.tsx` | Format last active time in org timezone |
| `src/components/workshops/WorkshopWhatsAppTab.tsx` | Format scheduled message times |
| `src/components/UpdateEmiDialog.tsx` | Format payment dates |
| `src/pages/Funnels.tsx` | Format created_at dates |

---

## Implementation Approach

### Step 1: Create a Timezone Hook

Create `useOrgTimezone` hook that provides ready-to-use functions bound to the current organization's timezone:

```typescript
// src/hooks/useOrgTimezone.ts
export function useOrgTimezone() {
  const { currentOrganization } = useOrganization();
  const timezone = currentOrganization?.timezone || DEFAULT_TIMEZONE;
  
  return {
    timezone,
    // Get "today" in org timezone (for filters)
    getToday: () => formatInOrgTime(new Date(), timezone, 'yyyy-MM-dd'),
    // Format any date for display
    format: (date: Date | string, formatStr: string) => 
      formatInOrgTime(date, timezone, formatStr),
    // Check if a date is "today" in org timezone
    isToday: (date: Date | string) => {
      const orgToday = formatInOrgTime(new Date(), timezone, 'yyyy-MM-dd');
      const dateStr = formatInOrgTime(date, timezone, 'yyyy-MM-dd');
      return orgToday === dateStr;
    },
  };
}
```

### Step 2: Update Date Filters

Update pages that use "today", "yesterday", "tomorrow" logic:

**DailyMoneyFlow.tsx (line 151):**
```typescript
// Before
const today = format(new Date(), "yyyy-MM-dd");

// After
const { getToday } = useOrgTimezone();
const today = getToday();
```

**Calls.tsx (lines 69-83):**
```typescript
// Before
const getSelectedDate = () => {
  const today = new Date();
  switch (dateFilter) {
    case 'today':
      return format(today, 'yyyy-MM-dd');
    ...
  }
};

// After
const { timezone, format: formatOrg } = useOrgTimezone();
const getSelectedDate = () => {
  switch (dateFilter) {
    case 'today':
      return formatOrg(new Date(), 'yyyy-MM-dd');
    ...
  }
};
```

### Step 3: Update Date Display

Replace all `format(new Date(dateString), ...)` calls with `formatInOrgTime`:

**Workshops.tsx (line 964):**
```typescript
// Before
{workshop.start_date ? format(new Date(workshop.start_date), "MMM dd, yyyy") : "N/A"}

// After
{workshop.start_date ? formatInOrgTime(workshop.start_date, timezone, "MMM dd, yyyy") : "N/A"}
```

**Batches.tsx (line 987, 2540):**
```typescript
// Before
{format(new Date(selectedBatch.start_date), "dd MMM yyyy")}

// After  
{formatInOrgTime(selectedBatch.start_date, timezone, "dd MMM yyyy")}
```

### Step 4: Update Time Calculations

Update time-based logic (call status checks, etc.):

**CloserAssignedCalls.tsx (lines 180-232):**
```typescript
// Before - Uses browser time
const now = new Date();
const callDateTime = new Date();
callDateTime.setHours(hours, minutes, 0, 0);
return now > callDateTime;

// After - Uses org timezone
const nowInOrg = toOrgTime(new Date(), timezone);
const callDateTime = toOrgTime(new Date(dateStr), timezone);
callDateTime.setHours(hours, minutes, 0, 0);
return nowInOrg > callDateTime;
```

---

## Files to Modify

| File | Action |
|------|--------|
| `src/hooks/useOrgTimezone.ts` | Create - New hook |
| `src/pages/Workshops.tsx` | Modify - Add org timezone formatting |
| `src/pages/Batches.tsx` | Modify - Add org timezone formatting |
| `src/pages/DailyMoneyFlow.tsx` | Modify - Update today/month logic |
| `src/pages/Calls.tsx` | Modify - Update date filters |
| `src/pages/CloserAssignedCalls.tsx` | Modify - Update time checks |
| `src/components/ScheduleCallDialog.tsx` | Modify - Schedule in org timezone |
| `src/components/RebookCallDialog.tsx` | Modify - Format dates |
| `src/components/ReassignCallDialog.tsx` | Modify - Date logic |
| `src/components/AddMoneyFlowDialog.tsx` | Modify - Today logic |
| `src/components/workshops/WorkshopWhatsAppTab.tsx` | Modify - Format times |
| `src/components/UpdateEmiDialog.tsx` | Modify - Payment dates |
| `src/pages/settings/WhatsAppConnection.tsx` | Modify - Last active time |
| `src/pages/Funnels.tsx` | Modify - Created dates |

---

## Testing Checklist

After implementation:
1. Set organization timezone to India (IST)
2. Access from a browser in a different timezone (e.g., Dubai)
3. Verify:
   - Workshop dates show correctly
   - Batch dates show correctly  
   - "Today" in Daily Money Flow matches IST date
   - Call appointments filter by IST date
   - Scheduled notifications show IST times
   - New call bookings are scheduled in IST

---

## Estimated Changes

- **~14 files** to modify
- **1 new hook** to create
- All changes are display/calculation logic - no database changes needed
