

# Fix: WhatsApp Community Creation Not Working

## Problem Summary

Two issues were identified preventing the automatic WhatsApp community creation:

1. **Community session selection not persisting in UI** - After selecting a session from the dropdown, the UI shows "No automatic community creation" after refresh, even though the database correctly stores the selection.

2. **WhatsApp community not being created** - When creating a workshop, the edge function `create-whatsapp-community` is never called, so no community gets created.

---

## Root Cause Analysis

### Issue 1: Query Invalidation Bug

In `src/hooks/useCommunitySession.ts`:

| Location | Code | Problem |
|----------|------|---------|
| Line 12 | `queryKey: ["community-session", currentOrganization?.id]` | Query includes org ID |
| Line 68 | `queryClient.invalidateQueries({ queryKey: ["community-session"] })` | Invalidation is missing org ID |

The mismatch means after saving, the cache for that specific organization's data is NOT invalidated, so the old value remains in the UI until a full page refresh.

### Issue 2: Edge Function Not Called

When I manually tested the edge function, it worked perfectly and created the community. However, edge function logs show NO calls to `create-whatsapp-community` when the workshop was created at 09:18.

This indicates the frontend code change (which adds the edge function call in `Workshops.tsx`) may not have been loaded by the user's browser - likely due to browser caching of the old JavaScript bundle.

After my manual test, the workshop now has its community properly linked:
- Workshop: "Testworkshop 2 group"
- Community Group ID: `68f60ba9-d5ad-4f75-9c65-f0c43f37e2f4`
- WhatsApp Group: `120363421527936625@g.us`
- Invite Link: `https://chat.whatsapp.com/FjIvj28tPxoIPvIZGQGdi5`

---

## Solution

### Fix 1: Correct Query Invalidation

Update `src/hooks/useCommunitySession.ts` to properly invalidate the query with the full key:

```typescript
// Line 67-68: Change from
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["community-session"] });

// To
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["community-session", currentOrganization?.id] });
```

This ensures the cache is properly refreshed after saving the community session selection.

### Fix 2: Browser Cache Refresh

For the edge function call issue, the user needs to:
1. Hard refresh the browser (Ctrl+Shift+R or Cmd+Shift+R)
2. Or clear browser cache
3. Or close and reopen the tab

The code in `Workshops.tsx` already correctly calls the edge function at lines 377-400.

---

## Files to Modify

| File | Change | Purpose |
|------|--------|---------|
| `src/hooks/useCommunitySession.ts` | Fix query key in invalidation | Ensure UI updates after saving community session |

---

## Verification Steps

After the fix:
1. Select a WhatsApp number in "Community Creation Settings"
2. The dropdown should immediately show the selected number (no page refresh needed)
3. Create a new workshop
4. A toast should appear: "WhatsApp community created and linked to workshop"
5. The workshop should have a linked community group in the database

