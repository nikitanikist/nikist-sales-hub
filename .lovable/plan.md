
# Fix: Default Workshop Time Should Be 7:00 PM IST

## Problem Identified

When new workshops are auto-created via TagMango webhook, the time is being set incorrectly:

| Workshop | Current UTC | Displayed in IST | Expected IST |
|----------|-------------|------------------|--------------|
| 31st January | 16:00:00+00 | 9:30 PM | **7:00 PM** |
| 30th January | 17:30:00+00 | 11:00 PM | **7:00 PM** |
| 1st February | 12:00:00+00 | 5:30 PM | **7:00 PM** |

**Root Cause Location:** `supabase/functions/ingest-tagmango/index.ts` (lines 88-98)

```typescript
// CURRENT CODE - WRONG
const tentativeDate = new Date(year, month, day, 12, 0, 0); // "Noon IST" ← Not actually IST!
return new Date(year, month, day, 12, 0, 0);
```

**Why it's wrong:**
1. `new Date(year, month, day, 12, 0, 0)` creates a date in the **server's timezone (UTC)**, not IST
2. The comment says "Noon IST" but it's actually setting noon UTC
3. When converted to IST, 12:00 UTC = 5:30 PM IST (not noon, not 7 PM)
4. There's no logic to use the organization's configured default_workshop_time

---

## Solution

Update the `parseDateFromWorkshopName` function to:
1. Set the time to **19:00 IST** (7:00 PM) which is the expected workshop time
2. Convert properly to UTC for storage: 19:00 IST = 13:30 UTC

**Changed code:**
```typescript
// Create date at 7:00 PM IST (19:00 IST = 13:30 UTC)
// IST is UTC+5:30, so 19:00 IST = 13:30 UTC
const istHour = 19; // 7 PM IST
const utcHour = istHour - 5; // 13 (accounting for +5 hours)
const utcMinute = 30; // accounting for +30 minutes (subtract from IST)

return new Date(Date.UTC(year, month, day, 13, 30, 0));
```

---

## Technical Details

### File to Change
`supabase/functions/ingest-tagmango/index.ts`

### Specific Changes

**Lines 86-98: Update the date creation logic**

```typescript
// OLD (lines 86-98):
const tentativeDate = new Date(year, month, day, 12, 0, 0); // Noon IST

const twoMonthsAgo = new Date(now);
twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

if (tentativeDate < twoMonthsAgo) {
  year++;
}

return new Date(year, month, day, 12, 0, 0);
```

```typescript
// NEW:
// Default workshop time: 7:00 PM IST = 13:30 UTC
// IST is UTC+5:30, so 19:00 IST = 19:00 - 5:30 = 13:30 UTC
const defaultWorkshopTimeUtcHour = 13;
const defaultWorkshopTimeUtcMinute = 30;

const tentativeDate = new Date(Date.UTC(year, month, day, defaultWorkshopTimeUtcHour, defaultWorkshopTimeUtcMinute, 0));

const twoMonthsAgo = new Date(now);
twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

if (tentativeDate < twoMonthsAgo) {
  year++;
}

return new Date(Date.UTC(year, month, day, defaultWorkshopTimeUtcHour, defaultWorkshopTimeUtcMinute, 0));
```

---

## Verification

After the fix, new workshops will have:
- **Stored in DB**: `2026-02-01 13:30:00+00` (UTC)
- **Displayed in IST**: `7:00 PM` ✓

---

## Impact

| Scope | Details |
|-------|---------|
| New workshops | Will be created with 7:00 PM IST default time |
| Existing workshops | No change (would need manual fix or data migration) |
| Deployment | Edge function auto-deploys |

---

## Optional: Fix Existing Workshops

If you want to fix the existing workshops that have wrong times, I can also provide a SQL query to update them to 7:00 PM IST. Let me know after approving this plan.
