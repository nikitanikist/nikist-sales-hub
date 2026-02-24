

# Fix: Remove Outdated Check Constraint on Dynamic Links

## Problem

The `dynamic_links` table has a check constraint (`dynamic_links_destination_check`) that enforces an XOR rule: either `destination_url` OR `whatsapp_group_id` must be set, but not both, and not neither.

Since the system was refactored to store WhatsApp invite URLs directly in `destination_url` (decoupled from `whatsapp_group_id`), this constraint now blocks link creation because `destination_url` is always set and `whatsapp_group_id` is always NULL -- but the constraint doesn't allow both to be in that state when the other is also NULL... actually it does allow that case. Let me re-read.

The constraint is: `(destination_url IS NOT NULL AND whatsapp_group_id IS NULL) OR (destination_url IS NULL AND whatsapp_group_id IS NOT NULL)`. This means having `destination_url` set and `whatsapp_group_id` NULL should be valid. The error likely occurs when **both** are being set (destination_url filled AND whatsapp_group_id filled), or when **neither** is set.

Looking at the current flow: when a WhatsApp group is selected, the system fetches the invite URL and puts it in `destination_url`, but the `whatsapp_group_id` column might still be getting populated in the insert/update query, causing both to be non-null and violating the constraint.

## Solution

### Database Migration

Drop the outdated check constraint and replace it with a simpler one that just requires `destination_url` to always be present (since all links now store their full URL directly):

```sql
ALTER TABLE public.dynamic_links
  DROP CONSTRAINT dynamic_links_destination_check;

ALTER TABLE public.dynamic_links
  ADD CONSTRAINT dynamic_links_destination_check
  CHECK (destination_url IS NOT NULL);
```

### Frontend Code Check

Verify the `CreateLinkDialog` component and `useDynamicLinks` hook to ensure `whatsapp_group_id` is not being sent in insert/update calls. If it is, remove it so only `destination_url` is populated.

