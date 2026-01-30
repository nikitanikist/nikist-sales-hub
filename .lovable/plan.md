
# Fix Workshop Date/Time to Always Use Organization Timezone (IST)

## The Problem

When you enter "1:00 AM January 31st" for a workshop, the system stores it incorrectly because:

| Step | What Happens Now | What Should Happen |
|------|------------------|-------------------|
| You enter "1:00 AM Jan 31" | Stored as 1:00 AM UTC | Stored as 1:00 AM IST (which is 7:30 PM UTC Jan 30) |
| System reads the date | Reads 1:00 AM UTC | Should read 1:00 AM IST |
| Notifications scheduled | Based on wrong UTC time | Based on correct IST time |

**Your Input = IST. Always. No matter where you are.**

---

## The Fix

### File: `src/pages/Workshops.tsx`

#### Change 1: Convert dates when saving (lines 504-529)

**Current code (broken):**
```typescript
const data = {
  start_date: formData.get("start_date"),  // Sent as-is to database
  end_date: formData.get("end_date"),      // Interpreted as UTC
};
```

**Fixed code:**
```typescript
import { fromOrgTime } from "@/lib/timezoneUtils";

const timezone = currentOrganization?.timezone || 'Asia/Kolkata';

// User input is "2026-01-31T01:00" - this MEANS 1 AM IST
const startDateInput = formData.get("start_date") as string;
const endDateInput = formData.get("end_date") as string;

// Create date objects from the input strings
// Then convert from IST to UTC for storage
const startDateUTC = fromOrgTime(new Date(startDateInput), timezone);
const endDateUTC = fromOrgTime(new Date(endDateInput), timezone);

const data = {
  start_date: startDateUTC.toISOString(),  // Now correctly stored as UTC
  end_date: endDateUTC.toISOString(),
};
```

#### Change 2: Show correct time when editing (lines 654-671)

**Current code (broken):**
```typescript
defaultValue={editingWorkshop?.start_date 
  ? format(new Date(editingWorkshop.start_date), "yyyy-MM-dd'T'HH:mm") 
  : ""}
```

This shows the stored UTC time in the browser's local timezone. Wrong!

**Fixed code:**
```typescript
import { formatInOrgTime } from "@/lib/timezoneUtils";

defaultValue={editingWorkshop?.start_date 
  ? formatInOrgTime(editingWorkshop.start_date, timezone, "yyyy-MM-dd'T'HH:mm") 
  : ""}
```

This converts stored UTC back to IST for display.

#### Change 3: Add timezone label to form fields

Add a visual indicator so users know times are in IST:

```typescript
<Label htmlFor="start_date">
  Start Date & Time <span className="text-muted-foreground text-xs">(IST)</span>
</Label>
```

---

## Data Flow After Fix

```text
You enter: "1:00 AM January 31st"
       ↓
System knows: Organization timezone = IST
       ↓
Interprets as: 1:00 AM IST on Jan 31
       ↓
Converts to UTC: 7:30 PM Jan 30 (UTC)
       ↓
Stores in database: 2026-01-30T19:30:00Z
       ↓
Notification system reads: 2026-01-30T19:30:00Z
       ↓
Calculates "11:26 PM" step: Jan 30 at 5:56 PM UTC = 11:26 PM IST Jan 30
       ↓
Message sends at correct time
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/Workshops.tsx` | Update `handleSubmit` to convert IST to UTC, update form `defaultValue` to show IST |

---

## Technical Implementation

```typescript
// In handleSubmit function (line 504)
const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const formData = new FormData(e.currentTarget);
  const timezone = currentOrganization?.timezone || 'Asia/Kolkata';
  
  // Get raw input strings
  const startDateInput = formData.get("start_date") as string;
  const endDateInput = formData.get("end_date") as string;
  
  // Convert from org timezone (IST) to UTC for storage
  const startDateUTC = startDateInput 
    ? fromOrgTime(new Date(startDateInput), timezone).toISOString() 
    : null;
  const endDateUTC = endDateInput 
    ? fromOrgTime(new Date(endDateInput), timezone).toISOString() 
    : null;
  
  const data = {
    title: formData.get("title"),
    description: formData.get("description"),
    start_date: startDateUTC,
    end_date: endDateUTC,
    // ... rest of fields unchanged
  };
  
  // ... rest of function unchanged
};
```

---

## Verification Steps

After implementation:
1. Create a new workshop with time "1:00 AM Jan 31"
2. Check database - should show `2026-01-30T19:30:00+00` (7:30 PM UTC = 1 AM IST)
3. Edit the workshop - form should show "1:00 AM Jan 31"
4. Run messaging sequence - notifications should schedule based on correct date
