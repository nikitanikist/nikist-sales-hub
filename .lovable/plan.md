

# Fix: Organization Feature Overrides Not Applied

## Root Cause

The Super Admin saves `disabled_permissions` and `disabled_integrations` in the `organization_feature_overrides` table, but **no frontend code reads this data**. The sidebar (`AppLayout.tsx`) and settings page (`OrganizationSettings.tsx`) completely ignore these overrides.

For the "One Percent Club" org, the super admin has disabled:
- **Permissions**: dashboard, daily_money_flow, sales, customers, customer_insights, call_schedule, sales_closers, workshops, products, cohort_batches
- **Integrations**: aisensy, calendly, pabbly

But the org admin sees everything because:
1. `useUserRole.tsx` gives admins ALL permissions unconditionally (line 155-158)
2. `OrganizationSettings.tsx` shows all integration tabs without checking overrides

## Solution

### 1. Create a hook: `useOrgFeatureOverrides`

A new hook that fetches the `organization_feature_overrides` for the current organization and exposes:
- `isPermissionDisabled(key)` -- checks if a permission is org-level disabled
- `isIntegrationDisabled(slug)` -- checks if an integration is org-level disabled
- Caches via React Query with the org ID as key

### 2. Update `AppLayout.tsx` sidebar filtering

In the `filterMenuItems` function, add an additional check: if a permission key is in the org's `disabled_permissions` array, hide that menu item -- even for admins. Super admins bypass this check.

### 3. Update `OrganizationSettings.tsx` integrations tab

Filter out integration tabs (Calendly, AISensy, Pabbly, Zoom) based on the org's `disabled_integrations` array. If all integrations are disabled, hide the entire Integrations tab.

### 4. Update route-level access in `AppLayout.tsx`

The `useEffect` that checks route access (line 225-248) should also consider org-level disabled permissions, redirecting users away from disabled routes.

## Technical Details

### New file: `src/hooks/useOrgFeatureOverrides.ts`

```typescript
// Fetches organization_feature_overrides for currentOrganization
// Returns: { disabledPermissions: string[], disabledIntegrations: string[], isLoading }
// Plus helper functions: isPermissionDisabled(key), isIntegrationDisabled(slug)
```

### Modified: `src/components/AppLayout.tsx`

- Import `useOrgFeatureOverrides`
- In `filterMenuItems`: before checking `hasPermission`, check if the permission key is in `disabledPermissions` (skip for super admins)
- In the route access `useEffect`: also check org-level disabled permissions
- Pass `isLoading` into the combined loading check

### Modified: `src/pages/OrganizationSettings.tsx`

- Import `useOrgFeatureOverrides`
- Filter integration tabs: hide tabs where the integration slug is in `disabledIntegrations`
- Example: if `disabled_integrations` includes `"calendly"`, hide the Calendly tab
- Integration slug mapping: `zoom`, `calendly`, `whatsapp`, `aisensy`, `pabbly` (for the webhooks/Pabbly tab)

### No database changes needed

The `organization_feature_overrides` table already has the correct schema with `disabled_permissions` and `disabled_integrations` arrays.

## Files

- **New**: `src/hooks/useOrgFeatureOverrides.ts`
- **Modified**: `src/components/AppLayout.tsx` -- sidebar + route filtering
- **Modified**: `src/pages/OrganizationSettings.tsx` -- integration tabs filtering

