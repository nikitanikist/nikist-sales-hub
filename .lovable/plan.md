

# Fix: Auto-Fetch Invite Link Resets Form State

## Problem Identified

After selecting a WhatsApp group and auto-fetching its invite link, the form state is unexpectedly reset:
- Switches back to "Custom URL" mode
- Clears the selected group
- Nothing appears to work

## Root Cause

In `CreateLinkDialog.tsx`, the form reset `useEffect` (lines 48-77) includes `groups` in its dependency array:

```tsx
useEffect(() => {
  if (open) {
    if (editingLink) {
      // ... editing logic
    } else {
      setDestinationType('url');    // Resets to URL mode!
      setSelectedGroupId(null);      // Clears group selection!
    }
  }
}, [open, editingLink, groups]);   // groups dependency causes re-run!
```

**Flow that causes the bug:**
1. User selects a group without invite link
2. Auto-fetch triggers `fetchInviteLink()`
3. On success, `queryClient.invalidateQueries()` refetches groups
4. `groups` reference changes, triggering the useEffect
5. Since `editingLink` is `null` (creating new), form resets to defaults
6. User sees "Custom URL" selected and no group chosen

## Solution

Remove `groups` from the dependency array of the form reset effect. The effect should only run when:
- `open` changes (dialog opens/closes)
- `editingLink` changes (switching between create/edit mode)

The `groups` dependency was likely added to set the session when editing an existing link (line 58-61), but this can be handled separately or by checking if we're already initialized.

## Implementation

### File: `src/components/operations/CreateLinkDialog.tsx`

**Change 1: Split the effect - remove groups from reset effect**

Current (lines 48-77):
```tsx
useEffect(() => {
  if (open) {
    if (editingLink) {
      // ... sets editing state including looking up group's session
    } else {
      setSlug('');
      setDestinationType('url');
      // ...
    }
  }
}, [open, editingLink, groups]); // ← groups causes bug
```

Updated:
```tsx
useEffect(() => {
  if (open) {
    if (editingLink) {
      setSlug(editingLink.slug);
      if (editingLink.whatsapp_group_id) {
        setDestinationType('whatsapp');
        setSelectedGroupId(editingLink.whatsapp_group_id);
        setDestinationUrl('');
      } else {
        setDestinationType('url');
        setDestinationUrl(editingLink.destination_url || '');
        setSelectedGroupId(null);
      }
    } else {
      setSlug('');
      setDestinationType('url');
      setDestinationUrl('');
      setSelectedGroupId(null);
    }
    setGroupSearch('');
    setError(null);
  }
}, [open, editingLink]); // ← Remove groups dependency
```

**Change 2: Add separate effect for setting session when editing**

This handles the case where we need to look up the group's session when editing:

```tsx
// Separate effect to set session ID when editing a WhatsApp group link
useEffect(() => {
  if (open && editingLink?.whatsapp_group_id && groups) {
    const group = groups.find(g => g.id === editingLink.whatsapp_group_id);
    if (group && !selectedSessionId) {
      setSelectedSessionId(group.session_id);
    }
  }
}, [open, editingLink, groups, selectedSessionId]);
```

## Summary of Changes

| Change | Purpose |
|--------|---------|
| Remove `groups` from reset effect dependency | Prevent form reset when groups refetch after invite link fetch |
| Add separate effect for editing session lookup | Preserve the functionality of finding the session for an existing link |

## Files to Modify

- `src/components/operations/CreateLinkDialog.tsx`

