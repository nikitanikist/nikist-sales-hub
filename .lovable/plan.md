

# Fix: Auto-Fetch Invite Link on Group Selection

## Problem

When selecting a WhatsApp group for a dynamic link, the error "Invite link not available. Bot needs admin rights" appears even though the connected account **is** the group admin.

**Root Cause**: The VPS `/groups/:sessionId` endpoint does NOT return invite links in its response. Invite links require a separate API call to `get-invite-link` for each group.

The current flow:
1. User syncs groups → VPS returns group list WITHOUT invite links
2. Database stores groups with `invite_link: null`
3. User selects a group → Code reads null from database → Shows error

---

## Solution

Automatically fetch the invite link when a group is selected and it doesn't have one stored. This uses the existing `fetchInviteLinkAsync` function.

### Changes Required

**File: `src/components/operations/CreateLinkDialog.tsx`**

| Line | Change |
|------|--------|
| 1-2 | Add `RefreshCw` import (already exists) |
| 23-24 | Destructure `fetchInviteLinkAsync` and `isFetchingInviteLink` from `useWhatsAppGroups()` |
| 34-35 | Add new state: `isFetchingLink` to track auto-fetch progress |
| 85-98 | Modify `handleGroupSelect` to auto-fetch invite link if not present |
| 376-387 | Update UI to show "Fetching invite link..." state |

---

## Implementation Details

### Updated handleGroupSelect Function

```typescript
// Handler for selecting a group - auto-fetches invite link if not present
const handleGroupSelect = async (groupId: string) => {
  const group = filteredGroups.find(g => g.id === groupId);
  if (!group) return;

  setSelectedGroupId(groupId);
  
  // Use invite_link stored in database if available
  if (group.invite_link) {
    setFetchedInviteLink(group.invite_link);
  } else if (selectedSessionId && group.group_jid) {
    // No link stored - auto-fetch from VPS
    setFetchedInviteLink(null);
    
    try {
      const result = await fetchInviteLinkAsync({
        sessionId: selectedSessionId,
        groupId: group.id,
        groupJid: group.group_jid,
      });
      
      if (result?.invite_link) {
        setFetchedInviteLink(result.invite_link);
      }
    } catch (error) {
      console.error('Failed to auto-fetch invite link:', error);
      // Error already shown by hook's onError
    }
  } else {
    setFetchedInviteLink(null);
  }
};
```

### Updated UI States

```typescript
{/* During fetch - show loading */}
{selectedGroup && isFetchingInviteLink && (
  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
    <RefreshCw className="h-3 w-3 animate-spin" />
    Fetching invite link...
  </p>
)}

{/* After fetch failed or not admin - show warning */}
{selectedGroup && !isFetchingInviteLink && !fetchedInviteLink && (
  <p className="text-xs text-yellow-600 ...">
    Invite link not available. Bot needs admin rights.
  </p>
)}

{/* After fetch success - show ready */}
{selectedGroup && !isFetchingInviteLink && fetchedInviteLink && (
  <p className="text-xs text-green-600 ...">
    Invite link ready
  </p>
)}
```

---

## Why This Solves the Problem

1. **No more false errors**: Instead of showing "Bot needs admin rights" when link is just missing from database, the system will try to fetch it
2. **Works for real admins**: If the account IS an admin, the VPS will return the invite link and it gets saved
3. **Correct error for non-admins**: Only shows the warning if the VPS call actually fails (meaning bot truly isn't admin)
4. **Database gets populated**: The fetched link is saved, so future selections won't need another API call

---

## Files to Modify

| File | Type | Summary |
|------|------|---------|
| `src/components/operations/CreateLinkDialog.tsx` | Edit | Add auto-fetch logic on group selection, update UI states |

