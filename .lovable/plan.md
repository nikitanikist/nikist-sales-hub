

# Fix Invite Link Property Name Mismatch

## The Problem

The edge function returns `invite_link` (snake_case), but the dialog code expects `inviteLink` (camelCase).

| Location | Property Used |
|----------|---------------|
| VPS Proxy Response | `invite_link` |
| CreateLinkDialog.tsx (line 120) | `inviteLink` ❌ |

This mismatch causes the fetched invite link to never be stored, resulting in the "Invite link not yet fetched" error.

---

## The Fix

Update `CreateLinkDialog.tsx` to use the correct property name:

```typescript
// Line 120 - Current (broken)
if (result?.inviteLink) {
  setFetchedInviteLink(result.inviteLink);
}

// Line 120 - Fixed
if (result?.invite_link) {
  setFetchedInviteLink(result.invite_link);
}
```

---

## File Change

| File | Change |
|------|--------|
| `src/components/operations/CreateLinkDialog.tsx` | Change `result?.inviteLink` to `result?.invite_link` (line 120-121) |

---

## Root Cause

When the VPS proxy was updated to return `invite_link` (matching database column naming convention), the frontend code wasn't updated to match. The fix is a simple property name correction.

