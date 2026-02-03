
# Simplify Dynamic Links with Invite Links During Sync

## Summary

The VPS now supports returning invite links during group sync. We just need to add `?includeInviteLinks=true` to the sync request. The edge function already has code to store `invite_link` in the database.

## Current Flow (Complicated)

```text
User selects group → No invite link in DB → Fetch from VPS → Auth errors → User frustrated
```

## New Flow (Simple)

```text
User syncs groups → Invite links stored in DB → User selects group → Link ready instantly
```

---

## Changes Required

### 1. Edge Function: Add Query Parameter

Update `supabase/functions/vps-whatsapp-proxy/index.ts` to include `?includeInviteLinks=true` when calling the VPS groups endpoint.

**Location**: Line 289 (sync-groups case)

| Before | After |
|--------|-------|
| `/groups/${vpsSessionIdForVps}` | `/groups/${vpsSessionIdForVps}?includeInviteLinks=true` |

The edge function already handles storing `inviteLink` from the response (lines 667-681):
```typescript
const inviteLink = g.inviteLink || g.invite_link || g.inviteCode 
  ? (g.inviteLink || g.invite_link || `https://chat.whatsapp.com/${g.inviteCode}`)
  : null;
```

### 2. Frontend: Read Invite Link from Database

Update `CreateLinkDialog.tsx` to use the `invite_link` already stored in the database instead of fetching on-demand.

**Changes**:
- Remove the VPS fetch call when selecting a group
- Read `invite_link` directly from the selected group object
- Show appropriate message if link is null (bot isn't admin)

### 3. Cleanup: Remove On-Demand Fetch Logic

The `fetchInviteLinkMutation` in `useWhatsAppGroups.ts` can be simplified or removed since we no longer need it for dynamic links.

---

## Technical Details

### Edge Function Change (1 line)

```typescript
// Line 289 - Before
vpsEndpoint = `/groups/${vpsSessionIdForVps}`;

// Line 289 - After
vpsEndpoint = `/groups/${vpsSessionIdForVps}?includeInviteLinks=true`;
```

### CreateLinkDialog Change

```typescript
// In handleGroupSelect - simplified version
const handleGroupSelect = (groupId: string) => {
  const group = groups?.find(g => g.id === groupId);
  setSelectedGroupId(groupId);
  
  // Use invite_link from database directly - no VPS call needed
  if (group?.invite_link) {
    setFetchedInviteLink(group.invite_link);
  } else {
    setFetchedInviteLink(null);
    // Link is null = bot isn't admin for this group
  }
};
```

---

## User Experience After Changes

| Step | What Happens |
|------|--------------|
| Sync Groups | VPS returns groups WITH invite links |
| Groups Stored | Database now has `invite_link` for each group |
| Create Dynamic Link | User selects group → link ready instantly |
| Bot Not Admin | Shows "Invite link not available" (bot needs admin rights) |

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/vps-whatsapp-proxy/index.ts` | Add `?includeInviteLinks=true` to sync endpoint |
| `src/components/operations/CreateLinkDialog.tsx` | Read invite_link from group object instead of fetching |
