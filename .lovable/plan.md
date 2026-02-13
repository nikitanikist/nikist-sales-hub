

# Filter Out Community Parent Groups from Send Notification

## Problem
Community parent JIDs appear as selectable groups in the Send Notification wizard. Sending to these container JIDs causes WhatsApp error 420.

## Changes

### 1. Database Migration -- Add community flag columns

Add two new boolean columns to `whatsapp_groups`:

```sql
ALTER TABLE whatsapp_groups
  ADD COLUMN is_community boolean NOT NULL DEFAULT false,
  ADD COLUMN is_community_announce boolean NOT NULL DEFAULT false;
```

### 2. VPS Proxy -- Store flags during group sync

**File: `supabase/functions/vps-whatsapp-proxy/index.ts`**

In the `groupsToUpsert` mapping (around line 841-855), add two fields from the VPS response:

```text
is_community: g.isCommunity === true,
is_community_announce: g.isCommunityAnnounce === true,
```

### 3. Frontend -- Filter out community parents from group selection

**File: `src/hooks/useWhatsAppGroups.ts`**

Two changes:

a) Add `is_community` and `is_community_announce` to the `WhatsAppGroup` interface and the select query.

b) Add a `sendableGroups` computed value that filters out community parents:
```text
const sendableGroups = groups?.filter(g => !g.is_community) || [];
```

This keeps community parents in the full `groups` list (useful for dashboard/management) but removes them from messaging contexts.

### 4. Send Notification Wizard -- Use filtered groups

Wherever the Send Notification wizard currently uses `groups` for selection, switch to using `sendableGroups` from the hook. This ensures community parent JIDs never appear as selectable options.

## Technical Details

- The VPS `/groups` endpoint already returns `isCommunity` and `isCommunityAnnounce` fields per group
- Announcement groups (`isCommunityAnnounce: true`) remain visible and sendable -- these are the correct targets
- Community parents (`isCommunity: true`) are containers only and are filtered out
- Existing groups will default to `false` for both flags until next sync
- After deploying, a re-sync of groups will populate the flags correctly

## Sequence

1. Run migration to add columns
2. Update VPS proxy to store flags during sync
3. Update `useWhatsAppGroups` hook with new fields and `sendableGroups`
4. Update Send Notification wizard to use `sendableGroups`
5. User re-syncs groups to populate the new flags

