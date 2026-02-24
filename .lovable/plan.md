

# Fix: Allow Deleting WhatsApp Session History

## Problem

When you delete a session from Session History, it tries to cascade-delete the associated WhatsApp groups. However, several tables reference `whatsapp_groups` without proper `ON DELETE` rules, so the database blocks the delete with a foreign key violation.

The problematic constraints (all missing `ON DELETE CASCADE` or `SET NULL`):

| Table | Constraint | Current Rule |
|-------|-----------|-------------|
| `notification_campaign_groups` | `group_id` | RESTRICT (blocks delete) |
| `webinars` | `whatsapp_group_id` | RESTRICT |
| `webinars` | `community_group_id` | RESTRICT |
| `webinar_whatsapp_groups` | `group_id` | RESTRICT |
| `scheduled_webinar_messages` | `group_id` | RESTRICT |

Tables that are already fine (no changes needed):
- `scheduled_whatsapp_messages` -- ON DELETE CASCADE
- `workshops` -- ON DELETE SET NULL
- `workshop_whatsapp_groups` -- ON DELETE CASCADE
- `whatsapp_group_admins` -- ON DELETE CASCADE
- `dynamic_links` -- ON DELETE SET NULL
- `workshop_group_members` -- ON DELETE SET NULL

## Solution

Run a database migration to update the foreign key constraints so deleting a group (and by extension, deleting a session) works cleanly.

### Database Migration

For each problematic constraint, drop and re-create it with the appropriate `ON DELETE` behavior:

- **`notification_campaign_groups.group_id`** -- Use `SET NULL`. Campaign history should be preserved (for analytics), but the group reference should be cleared.
- **`webinars.whatsapp_group_id`** -- Use `SET NULL`. The webinar record stays, just unlinked from the deleted group.
- **`webinars.community_group_id`** -- Use `SET NULL`. Same reasoning.
- **`webinar_whatsapp_groups.group_id`** -- Use `CASCADE`. This is a junction table; if the group is gone, the link row has no purpose.
- **`scheduled_webinar_messages.group_id`** -- Use `CASCADE`. Pending messages for a deleted group should be removed.

### No Frontend Changes Needed

The existing delete logic in `useWhatsAppSession.ts` already handles the delete call and shows success/error toasts. Once the database constraints are fixed, it will just work.
