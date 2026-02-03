

# Fix "Unauthorized" Error When Selecting WhatsApp Group

## The Problem

When you select a WhatsApp group in the Create Dynamic Link dialog, you see an "Unauthorized" toast error. This happens when the group doesn't have a cached invite link and the system tries to fetch one from the VPS.

## Root Cause

The edge function logs show `Auth session missing!` errors. This means the authentication token is not being properly passed to the `vps-whatsapp-proxy` edge function when calling `fetchInviteLinkAsync`.

The issue is a **timing/state problem**: The mutation is being called but the Supabase client's auth session is not being attached to the request properly.

## The Solution

The fix involves two changes:

### 1. Add Session Validation Before Fetching

Before attempting to fetch the invite link from VPS, verify the user session is valid. If not, skip the VPS call and show a helpful message instead of an "Unauthorized" error.

### 2. Improve Error Handling with Better User Feedback

When the fetch fails, provide clearer feedback about what happened and how to resolve it.

---

## Files to Change

| File | Change |
|------|--------|
| `src/hooks/useWhatsAppGroups.ts` | Add session check before edge function call |
| `src/components/operations/CreateLinkDialog.tsx` | Handle auth failures gracefully |

---

## Technical Implementation

### 1. Update `useWhatsAppGroups.ts`

Add a session check before calling the edge function:

```typescript
// In fetchInviteLinkMutation mutationFn
const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  throw new Error('Session expired. Please refresh the page and try again.');
}

const response = await supabase.functions.invoke('vps-whatsapp-proxy', {
  // ... existing code
});
```

### 2. Update `CreateLinkDialog.tsx`

If the group doesn't have an invite link and we can't fetch one, allow the user to proceed anyway (they can try again later or pick a different group):

```typescript
// In handleGroupSelect catch block
} catch (error) {
  console.error('Failed to fetch invite link:', error);
  // Don't block the flow - user can still select a different group
  // or try to refresh and create the link later
}
```

Also, improve the helper text when invite link fetch fails to indicate they may need to refresh their session.

---

## User Experience After Fix

1. User opens Create Link dialog
2. Selects WhatsApp Group and picks a group
3. If session is valid: Invite link is fetched and stored
4. If session expired: Shows "Session expired. Please refresh the page." message instead of generic "Unauthorized"
5. User can refresh the page and try again

---

## Why This Happens

The Supabase auth token has an expiration time. When the user has the dialog open for a while or there's a delay in token refresh, the edge function may receive an expired token. This is a normal edge case that needs graceful handling.

