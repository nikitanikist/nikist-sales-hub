

# Fix: IVR Routes Redirecting Due to Module Guard Race Condition

## Root Cause

The `useModules` hook has a race condition. When `currentOrganization` is not yet loaded:

1. The org modules query is **disabled** (`enabled: !!currentOrganization?.id`)
2. Disabled queries report `isLoading: false` in React Query
3. So `useModules().isLoading` returns `false` while `orgModules` is still empty `[]`
4. `ModuleGuard` sees loading is done, checks `isModuleEnabled('ivr-campaigns')` → returns `false` (empty array)
5. Immediately redirects to `/whatsapp`

This affects ALL module-gated routes (cohorts, daily-money-flow, etc.), but IVR is likely the first one where you noticed it because the other module-gated items also have permission-based sidebar filtering that might mask the issue.

## Fix

**File: `src/hooks/useModules.ts`** — Include `currentOrganization` loading state in the `isLoading` return. The organization context must be ready before we can determine module status.

Change the `isLoading` return to also account for when `currentOrganization` is null but the user is authenticated (org is still loading):

```typescript
// Add useOrganization's isLoading to the check
const { currentOrganization, isSuperAdmin, isLoading: orgLoading } = useOrganization();

return {
  // ...
  isLoading: modulesLoading || orgModulesLoading || (orgLoading && !currentOrganization),
};
```

This ensures `ModuleGuard` shows a loading spinner until the organization context is fully resolved, preventing the premature redirect.

**Secondary fix — `src/lib/permissions.ts`** — Add `/ivr` prefix handling in `getPermissionForRoute` so the route permission system recognizes IVR routes under the `calling` permission:

```typescript
// Handle IVR routes (under calling permission)
if (path.startsWith('/ivr')) {
  return PERMISSION_KEYS.calling;
}
```

Also add explicit IVR route entries to `ROUTE_TO_PERMISSION`:
```typescript
'/ivr/dashboard': PERMISSION_KEYS.calling,
'/ivr/campaigns': PERMISSION_KEYS.calling,
'/ivr/audio-library': PERMISSION_KEYS.calling,
```

## Files Changed
- `src/hooks/useModules.ts` — Fix loading state to include org context loading
- `src/lib/permissions.ts` — Add IVR route permission mappings

