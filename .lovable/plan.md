
## What’s actually happening (root cause)

Your workshop *is* being stored correctly as “Indian time”, but the “Workshop Notification” screen is *displaying* the date incorrectly.

Here’s why:

- The workshop start time is stored in the database in **UTC** (this is normal and correct).
- Example: **Jan 31, 1:00 AM IST** equals **Jan 30, 7:30 PM UTC**.
- So in the database the timestamp looks like it’s on **Jan 30** (UTC date), even though in IST it’s **Jan 31**.

Now the bug:
- The **/operations/workshop-notification** page currently does this:
  - It takes `workshop.start_date`
  - **splits the string** and keeps only the `"YYYY-MM-DD"` part (the UTC day)
  - and shows that as the workshop date

So for early-morning IST workshops (like 1 AM), it will wrongly show the **previous day** (Jan 30) because it’s literally using the UTC date part.

This is exactly in your code right now:

- `src/pages/operations/WorkshopNotification.tsx`
  - `const datePart = workshop.start_date.split('T')[0];`
  - This guarantees the displayed day becomes the UTC day, not the IST day.

And the same “split datePart” logic exists in:
- `src/components/operations/WorkshopDetailSheet.tsx`

That’s why you are seeing “30 January” in Operations even though you selected “31 January 1 AM IST”.

---

## What we need to change (high level)

We must stop stripping the UTC date part and instead **format `start_date` in the organization timezone** when displaying it.

So:
- Display date in Workshop Notification table using **org timezone**
- Display date in Workshop Detail Sheet using **org timezone**
- (Optional but recommended) Fix “Send Message Now” preview so `{date}` / `{time}` also respect org timezone (right now it formats in browser timezone)

No database changes needed.

---

## Implementation steps (code changes)

### 1) Fix the Workshop Notification list date (the main thing you’re complaining about)
**File:** `src/pages/operations/WorkshopNotification.tsx`

Replace this whole block:

```ts
const datePart = workshop.start_date.split('T')[0];
const workshopDate = new Date(datePart + 'T12:00:00');
format(workshopDate, 'MMM d')
```

with formatting that respects org timezone, e.g.:

- Use `orgTimezone` from `useWorkshopNotification()` (it already exists in that hook return)
- Use `formatInOrgTime(workshop.start_date, orgTimezone, ...)`

Result: “Jan 31” will show correctly even if the stored UTC timestamp is Jan 30.

### 2) Fix the Workshop Detail Sheet “Workshop Date” display
**File:** `src/components/operations/WorkshopDetailSheet.tsx`

Remove:

```ts
const datePart = workshop.start_date.split('T')[0];
const workshopDate = new Date(datePart + 'T12:00:00');
```

and display directly from `workshop.start_date` using `formatInOrgTime(..., orgTimezone, ...)`.

This ensures the date inside the “View” sheet matches the actual IST date.

### 3) (Recommended) Fix “Send Message Now” template preview timezone
**File:** `src/components/operations/SendMessageNowDialog.tsx`

Right now it does:

```ts
format(workshopDate, 'MMMM d, yyyy')
format(workshopDate, 'h:mm a')
```

That uses browser timezone.

To keep everything consistent with “Org is IST always”, we should:
- Pass `timezone` (org timezone) to the dialog (new prop), OR pass the raw `start_date` string
- Format using `formatInOrgTime(..., timezone, ...)`

This prevents template previews showing the wrong date/time when you’re outside India.

### 4) (Quick audit) Ensure no other “split('T')[0]” is used for workshop dates
We already searched and found only these two places:
- `src/pages/operations/WorkshopNotification.tsx`
- `src/components/operations/WorkshopDetailSheet.tsx`

So fixing these two will address your “Jan 30 instead of Jan 31” problem in Operations.

---

## How we’ll verify (what you should see after the fix)

Using your example:
- You create: **Jan 31, 1:00 AM IST**
- Database stores: **Jan 30, 19:30 UTC** (expected)
- Workshop Notification page should display: **Jan 31** (IST day)
- Workshop Detail Sheet should display: **Jan 31** (IST day)
- (If we do step #3) Send Message Now preview should also show **Jan 31, 1:00 AM** (IST)

---

## Why this bug appeared now

The “split datePart” trick was originally added to avoid timezone shifting *when treating workshops as date-only events*.

But now that workshops are real timestamps stored in UTC (which is correct), stripping the time is the wrong approach because it throws away the timezone conversion step that makes UTC display correctly as IST.

This is why you’re seeing the day mismatch specifically for workshops around midnight / early morning.

---

## No backend/schema changes

This is 100% frontend rendering logic. Existing workshops will immediately display correctly once the formatting is fixed.
