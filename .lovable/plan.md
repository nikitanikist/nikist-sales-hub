

# Fix: WhatsApp Group Invite Links Not Displaying

## Problem Summary

The WhatsApp group invite links are not visible because:

1. **Sync doesn't save invite links**: When groups are synced from WhatsApp via the `vps-whatsapp-proxy` edge function, the `invite_link` field is not being saved to the database (line 596-608 only saves: organization_id, session_id, group_jid, group_name, participant_count, is_active, is_admin, synced_at, updated_at).

2. **Most groups have null invite_link**: Out of all your WhatsApp groups, only 2 test groups have invite links stored. All production groups (like "Crypto Masterclass <> 1st February") have `invite_link: null`.

| Group | Invite Link |
|-------|-------------|
| Testworkshop 2 group | `https://chat.whatsapp.com/...` |
| group test 1 | `https://chat.whatsapp.com/...` |
| Crypto Masterclass <> 1st February | **null** |
| All other groups | **null** |

---

## Solution

Update the `vps-whatsapp-proxy` edge function to capture and store invite links when syncing groups from WhatsApp.

### File to Modify

**`supabase/functions/vps-whatsapp-proxy/index.ts`**

### Changes

In the sync-groups handling section (around line 596-608), add `invite_link` to the group data being saved:

```typescript
// Current code (missing invite_link):
return {
  organization_id: organizationId,
  session_id: localSessionIdForDb,
  group_jid: g.id || g.jid || g.groupId,
  group_name: g.name || g.subject || 'Unknown Group',
  participant_count: ...,
  is_active: true,
  is_admin: isAdmin,
  synced_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Updated code (with invite_link):
return {
  organization_id: organizationId,
  session_id: localSessionIdForDb,
  group_jid: g.id || g.jid || g.groupId,
  group_name: g.name || g.subject || 'Unknown Group',
  participant_count: ...,
  is_active: true,
  is_admin: isAdmin,
  invite_link: g.inviteLink || g.invite_link || g.inviteCode 
    ? `https://chat.whatsapp.com/${g.inviteCode || ''}` 
    : (g.inviteLink || g.invite_link || null),
  synced_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
```

---

## Important Notes

1. **VPS must return invite links**: This fix assumes the VPS `/groups/{sessionId}` endpoint returns invite links. If it doesn't, you'll need to:
   - Update the VPS to include invite links in the group list response, OR
   - Add a separate "Get Invite Link" button that calls a VPS endpoint to fetch the invite link for a specific group

2. **Existing groups need re-sync**: After deploying this fix, you'll need to click the "Sync Groups" button to re-fetch groups and populate their invite links.

3. **Groups where you're not admin**: WhatsApp only provides invite links for groups where you have admin privileges. Non-admin groups will still have `null` invite links.

---

## Testing Plan

1. Deploy the updated edge function
2. Go to a workshop with linked groups
3. Click "Sync Groups" to refresh the group data
4. The invite link should now appear for groups where you're an admin

