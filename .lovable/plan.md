

# Fix: Post-Login Redirect and Sidebar Menu Flicker

## What's Happening

**Issue 1 -- Wrong landing page after login:**
When you log in as the onepercentclub.io organization, you're landing on the Team Members page (`/users`) instead of going to the first meaningful page for your org. This happens because:
- After login, the app always goes to `/`
- Then it redirects to `/whatsapp` (hardcoded default)
- Then it detects WhatsApp is not accessible for this org and bounces again to the first available route (`/users`)

This multi-hop redirect should instead go directly to the first page you actually have access to.

**Issue 2 -- Menu flicker on page refresh:**
On refresh, the sidebar briefly flashes all menus (Dashboard, Customers, etc.) before settling on the correct restricted set. This happens because the organization-level feature overrides load slightly after the role/permissions data, creating a brief window where the sidebar renders without the org restrictions applied.

## Plan

### 1. Smart redirect after login (AppLayout.tsx)

Instead of always redirecting `/` to `/whatsapp`, calculate the first accessible route based on the user's actual permissions and org feature overrides, then redirect there. This eliminates the multi-hop bounce.

### 2. Smart redirect after login (ProtectedRoute.tsx)

Same fix -- instead of hardcoding `Navigate to="/whatsapp"`, compute the first accessible route dynamically.

### 3. Prevent sidebar flicker (AppLayout.tsx)

Ensure the loading screen stays visible until ALL async data is fully resolved -- including the organization context itself (`currentOrganization`). Currently, if the organization loads a frame after the role, the sidebar renders unfiltered menus briefly. Adding `!currentOrganization` (for non-super-admins) to the loading condition will prevent this.

## Technical Details

**Files to modify:**

1. **`src/components/AppLayout.tsx`**
   - Add a helper function `getFirstAccessibleRoute()` that iterates through `ROUTE_TO_PERMISSION` entries and returns the first route where `hasPermission(key)` is true and `isPermissionDisabled(key)` is false
   - In the `/` redirect `useEffect` (line 217-225): replace `navigate("/whatsapp")` with `navigate(getFirstAccessibleRoute())`
   - In the loading guard (line 467): add `(!isSuperAdmin && !currentOrganization)` to keep the loading screen until the org context is ready

2. **`src/components/ProtectedRoute.tsx`**
   - Replace the hardcoded `<Navigate to="/whatsapp" replace />` (line 37) with logic that computes the first accessible route using the same permission checks
   - This requires importing `useOrgFeatureOverrides` and `ROUTE_TO_PERMISSION` to determine the correct landing page

3. **`src/pages/Auth.tsx`** (no changes needed)
   - Auth already navigates to `/`, which is correct -- the downstream redirects will handle the rest

