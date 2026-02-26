
# Fix: Sidebar Shows Wrong Menu Items on First Login (Race Condition)

## Root Cause

The `useUserRole` hook reads the current organization ID directly from `localStorage` (line 81) and only re-runs when `user?.email` changes. It does NOT re-run when the organization context loads.

Here's what happens on first login for One Percent Club:

```text
Timeline:
1. User signs in --> user state set
2. useUserRole fires --> reads localStorage("lovable_current_org_id")
   --> localStorage is EMPTY (first login / cleared session)
   --> org membership query skipped (no orgId)
   --> falls back to global user_roles table
   --> no admin role found there (role is in organization_members)
   --> role = null --> defaults to "viewer" permissions
3. useOrganization fires --> fetches orgs from DB
   --> sets currentOrganization + saves to localStorage
4. BUT useUserRole does NOT re-run (it only watches user?.email)
   --> sidebar renders with "viewer" permissions = only "Team Members"
5. User refreshes page
   --> localStorage now has the correct org ID
   --> useUserRole reads it correctly --> finds "admin" role
   --> sidebar renders correctly with all items
```

The bug is that `useUserRole` is disconnected from the organization context. It reads a stale localStorage value and never updates when the organization loads.

## The Fix

### File: `src/hooks/useUserRole.tsx`

**Change 1: Accept org ID from context instead of reading localStorage**

- Add `currentOrgId` as a parameter read from the organization context, or more practically, add `currentOrganization?.id` to the dependency array
- Since `useUserRole` can't import `useOrganization` (it's used before the provider in some cases), the simplest fix is to read from localStorage BUT also add `window.addEventListener('storage')` or -- even simpler -- add a reactive dependency

The cleanest approach: read the org ID from localStorage inside the effect, but add a **re-trigger** mechanism. Since `useOrganization` saves to localStorage via `switchOrganization` and `fetchOrganizations`, we need `useUserRole` to re-run when that value changes.

**Solution: Pass org ID as a dependency.** Since both hooks are used inside `AppLayoutContent` which is inside `OrganizationProvider`, we can make `useUserRole` accept an optional `organizationId` parameter:

```typescript
export const useUserRole = (organizationId?: string | null): UseUserRoleReturn => {
  // ... existing code ...
  
  useEffect(() => {
    const fetchUserRole = async () => {
      // Use provided org ID, fall back to localStorage
      const currentOrgId = organizationId ?? localStorage.getItem("lovable_current_org_id");
      // ... rest of fetch logic using currentOrgId ...
    };
    fetchUserRole();
  }, [user?.email, organizationId]); // <-- add organizationId as dependency
```

**Change 2: Update `AppLayout.tsx` to pass org ID**

In `AppLayoutContent`, update the `useUserRole` call:

```typescript
const { currentOrganization } = useOrganization();
const { isAdmin, isCloser, ... } = useUserRole(currentOrganization?.id);
```

**Change 3: Update `ProtectedRoute.tsx`**

The `ProtectedRoute` also uses `useUserRole()`. It is rendered inside `AppLayout` (via `Outlet`), so it has access to `OrganizationContext`. Update it to pass the org ID as well. Since it doesn't currently import `useOrganization`, add that import and pass `currentOrganization?.id`.

### File: `src/hooks/useOrgFeatureOverrides.ts` (no change needed)

This hook already correctly depends on `currentOrganization?.id` from context.

### File: `src/hooks/useModules.ts` (no change needed)

This hook already correctly depends on `currentOrganization?.id` from context.

## Why This Fixes It

- On first login, `currentOrganization` starts as `null` --> `useUserRole(null)` runs with no org --> loading state
- When `useOrganization` resolves the org --> `currentOrganization.id` changes --> `useUserRole(orgId)` re-runs --> correct role + permissions
- The loading guard in `AppLayout` (line 499) already blocks rendering until `currentOrganization` is set, so the brief null state won't show the wrong sidebar

## Files to Change

1. `src/hooks/useUserRole.tsx` -- Accept optional `organizationId` param, add to useEffect dependency
2. `src/components/AppLayout.tsx` -- Pass `currentOrganization?.id` to `useUserRole()`
3. `src/components/ProtectedRoute.tsx` -- Pass `currentOrganization?.id` to `useUserRole()`
