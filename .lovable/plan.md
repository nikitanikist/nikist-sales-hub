

# Simplify Dynamic Links for WhatsApp Groups

## The Problem

Currently, WhatsApp group links store a reference (`whatsapp_group_id`) and look up the `invite_link` at redirect time. This fails when the invite link is null in the database.

## The Better Approach

When a user selects a WhatsApp group:
1. Fetch the invite link immediately (this already happens via `fetchInviteLink`)
2. Store the invite URL directly in `destination_url` 
3. No need for `whatsapp_group_id` reference at all
4. Redirect is instant and always works

## Files to Change

| File | Change |
|------|--------|
| `src/components/operations/CreateLinkDialog.tsx` | Store fetched invite link as `destination_url` instead of `whatsapp_group_id` |
| `src/hooks/useWhatsAppGroups.ts` | Return the fetched invite link from mutation |

No changes needed to the redirect logic - it already handles `destination_url` perfectly.

---

## Implementation Details

### 1. Update `useWhatsAppGroups.ts`

The `fetchInviteLinkMutation` needs to return the actual invite link so the dialog can use it:

```typescript
// Current: just invalidates query and shows toast
onSuccess: () => {
  queryClient.invalidateQueries({ ... });
  toast.success('Invite link fetched');
}

// New: return the invite link data
onSuccess: (data) => {
  queryClient.invalidateQueries({ ... });
  toast.success('Invite link fetched');
  return data; // Contains inviteLink
}
```

### 2. Update `CreateLinkDialog.tsx`

**Current flow:**
- Select group → store `whatsapp_group_id`
- Fetch invite link in background (not used directly)
- Submit: `whatsapp_group_id: selectedGroupId`

**New flow:**
- Select group → fetch invite link immediately
- Store the invite link URL in local state
- Submit: `destination_url: fetchedInviteLink`

```typescript
// Add state for the fetched invite link
const [fetchedInviteLink, setFetchedInviteLink] = useState<string | null>(null);

// When group is selected, fetch and store the link
const handleGroupSelect = async (groupId: string) => {
  const group = filteredGroups.find(g => g.id === groupId);
  if (!group) return;

  setSelectedGroupId(groupId);

  // If group already has invite link, use it directly
  if (group.invite_link) {
    setFetchedInviteLink(group.invite_link);
  } else if (selectedSessionId) {
    // Fetch from VPS and store result
    const result = await fetchInviteLinkAsync({
      sessionId: selectedSessionId,
      groupId: group.id,
      groupJid: group.group_jid,
    });
    setFetchedInviteLink(result.inviteLink);
  }
};

// On submit for WhatsApp type
createLink({
  slug: slug.trim(),
  destination_url: fetchedInviteLink, // Store the actual URL!
  // No whatsapp_group_id needed
});
```

### 3. Validation Change

**Current:**
```typescript
if (!selectedGroup?.invite_link) {
  setError('Selected group has no invite link');
  return;
}
```

**New:**
```typescript
if (!fetchedInviteLink) {
  setError('Invite link not yet fetched. Please wait or select another group.');
  return;
}
```

---

## User Experience

1. User opens Create Link dialog
2. Selects "WhatsApp Group" destination type
3. Chooses a WhatsApp account and group
4. System immediately fetches the invite link (shows loading state)
5. Once fetched, user can save the link
6. The invite URL is stored directly - redirect is instant and reliable

---

## Benefits

- **Instant redirects** - No database lookups or VPS calls at redirect time
- **Self-contained** - Link has everything it needs in `destination_url`
- **Reliable** - No missing invite link issues
- **Simpler code** - Remove complexity from redirect logic
- **Backward compatible** - Existing URL links work the same way

