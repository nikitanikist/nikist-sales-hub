

# Fix: Super Admin Auto-Redirect to Super Admin Dashboard

## Problem
When a super admin logs in, they land on `/` (the regular Dashboard page), which requires an organization to be selected. Since super admins operate above the organization level, they see "No Organization Selected" — a dead end. The sidebar correctly shows only "Super Admin Dashboard" but the user has to manually click it.

## Root Cause
There is no redirect logic that sends super admins to `/super-admin` when they land on the default `/` route.

## Solution
Add a redirect in `AppLayout` (or `Dashboard`) so that when a super admin user is detected and the current route is `/`, they are automatically navigated to `/super-admin`.

### Changes

**`src/components/AppLayout.tsx`** (1 change)
- In the `AppLayoutContent` component, add a `useEffect` that checks: if `isSuperAdmin` is true and `location.pathname === "/"`, navigate to `/super-admin`. This runs after role loading completes, ensuring the super admin flag is resolved before redirecting.

```
useEffect(() => {
  if (!roleLoading && !loading && user && isSuperAdmin && location.pathname === "/") {
    navigate("/super-admin");
  }
}, [isSuperAdmin, roleLoading, loading, user, location.pathname, navigate]);
```

This is a single, minimal change. No database migrations, no new files — just a redirect rule so super admins always land on their dashboard.

