
# Fix Workshop Notification - Ambiguous Relationship Error

## Problem

The Workshop Notification page shows "No workshops found" because the database query is failing with a **300 status error**. The error message says:

> "Could not embed because more than one relationship was found for 'workshops' and 'whatsapp_groups'"

This happens because there are two ways to link workshops and WhatsApp groups in the database, and the system doesn't know which one to use.

---

## Solution

Update the database query to explicitly specify which relationship to use when fetching WhatsApp group data.

---

## File to Modify

| File | Change |
|------|--------|
| `src/hooks/useWorkshopNotification.ts` | Specify the exact foreign key relationship in the query |

---

## Technical Change

**Current code (line 69):**
```typescript
whatsapp_group:whatsapp_groups(id, group_name, group_jid)
```

**Fixed code:**
```typescript
whatsapp_group:whatsapp_groups!workshops_whatsapp_group_id_fkey(id, group_name, group_jid)
```

This tells the query to use the `workshops.whatsapp_group_id` → `whatsapp_groups.id` relationship (many-to-one), which is the correct one for fetching the linked WhatsApp group for each workshop.

---

## Expected Result

After this fix:
- The Workshop Notification page will successfully fetch all workshops
- All workshops from your organization will appear in the table
- Tags, registrations, and other data will display correctly

---

## Estimated Time

5 minutes to implement and test
