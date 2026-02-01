
# Fix SMS Sequence Display and Settings Navigation

## Problems Found

1. **SMS Sequence shows "Not assigned"** - The system isn't fetching the SMS sequence data from the database when loading workshops
2. **404 Error on Settings link** - The button links to a route that doesn't exist

## Root Causes

### Issue 1: Missing SMS Sequence Data
When loading workshops, the system fetches tag information but only includes `template_sequence_id` (for WhatsApp), not `sms_sequence_id`. Even though the tag "Crypto insider workshop" has an SMS sequence assigned in the database, it's not being retrieved.

**Current query:**
```
tag:workshop_tags(id, name, color, template_sequence_id)
```

**Missing field:** `sms_sequence_id`

### Issue 2: Incorrect Route Path
The links point to `/settings/organization?tab=notifications` but the route defined in the app is `/settings`.

---

## Solution

### Step 1: Update Workshop Query
Modify `useWorkshopNotification.ts` to fetch `sms_sequence_id` from workshop tags.

**File:** `src/hooks/useWorkshopNotification.ts`

**Change:** Update the Supabase query on line 72 to include `sms_sequence_id`:
```typescript
tag:workshop_tags(id, name, color, template_sequence_id, sms_sequence_id),
```

Also update the `WorkshopWithDetails` interface (around line 41-45) to include the `sms_sequence_id` field.

### Step 2: Fix Navigation Links
Update the links in `SMSTab.tsx` to use the correct route path.

**File:** `src/components/operations/notification-channels/SMSTab.tsx`

**Changes:**
- Line 273: Change `/settings/organization?tab=notifications` to `/settings?tab=notifications`
- Line 347: Change `/settings/organization?tab=notifications` to `/settings?tab=notifications`

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/hooks/useWorkshopNotification.ts` | Add `sms_sequence_id` to the tag query and interface |
| `src/components/operations/notification-channels/SMSTab.tsx` | Fix route paths from `/settings/organization` to `/settings` |

After these changes, workshops with the "Crypto insider workshop" tag will correctly show the SMS sequence as assigned, and clicking the settings button will navigate to the correct page.
