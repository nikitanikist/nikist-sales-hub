

# Add is_admin Filter to Sendable Groups

## What's Already Done
- The `is_admin` column exists in `whatsapp_groups` (boolean, default false)
- The VPS proxy already stores `is_admin` during group sync (line 855)
- The frontend hook already fetches `is_admin` from the database

## Single Change Needed

**File: `src/hooks/useWhatsAppGroups.ts` (line 195)**

Update the `sendableGroups` filter to also require `is_admin`:

```typescript
// Before
const sendableGroups = groups?.filter(g => !g.is_community) || [];

// After
const sendableGroups = groups?.filter(g => !g.is_community && g.is_admin) || [];
```

## Result
After a group re-sync, only groups where the connected WhatsApp account is an admin will appear in the Send Notification wizard. Non-admin groups and community parents are both excluded.

No database migration or edge function changes are needed -- everything is already wired up.

