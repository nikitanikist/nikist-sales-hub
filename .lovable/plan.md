

# Change Default Landing Page for Organization Admins

## What Changes

When a non-super-admin user logs in or navigates to `/`, instead of showing the Dashboard page, redirect them to `/whatsapp` (the WhatsApp Dashboard).

## Technical Changes

### 1. `src/components/AppLayout.tsx`

Add a redirect in the existing `useEffect` (around line 217): when the user is **not** a super admin, is on `/`, and has finished loading, navigate to `/whatsapp`.

```typescript
// Existing: super admin -> /super-admin
// New: regular users -> /whatsapp
if (!roleLoading && !loading && user && !isSuperAdmin && location.pathname === "/") {
  navigate("/whatsapp");
}
```

### 2. `src/components/ProtectedRoute.tsx`

Update the root route handler so that when a non-super-admin hits `/`, they get redirected to `/whatsapp` instead of rendering the Dashboard.

### 3. Fallback redirects

Update places that redirect to `/` (e.g., `ModuleGuard.tsx` line 43) to redirect to `/whatsapp` instead, so disabled modules send users to the WhatsApp dashboard rather than the old dashboard.

## Files

- **Modified**: `src/components/AppLayout.tsx` -- add redirect from `/` to `/whatsapp` for non-super-admins
- **Modified**: `src/components/ProtectedRoute.tsx` -- redirect `/` to `/whatsapp` for regular users
- **Modified**: `src/components/ModuleGuard.tsx` -- change fallback redirect from `/` to `/whatsapp`

