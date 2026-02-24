

# Fix: Login Failing Due to Stale Token Retry Loop

## The Problem

The browser has a corrupt refresh token (`ddifeamml345`) stored in localStorage. The Supabase client has `autoRefreshToken: true`, so it picks up this token on page load and enters an endless retry loop of failed refresh requests. This consumes the network connection and prevents the actual sign-in request from completing, causing the 15-second timeout every time.

The current cleanup code (clearing `sb-*-auth-token` from localStorage) races with the Supabase client -- by the time our cleanup runs, the client has already loaded the bad token into memory and is retrying.

## The Fix

### File: `src/pages/Auth.tsx`

**Replace the localStorage cleanup with a proper local sign-out:**

Instead of manually clearing localStorage keys, call `supabase.auth.signOut({ scope: 'local' })` on mount. This:
- Clears the in-memory session in the Supabase client (stops the retry loop)
- Clears the localStorage tokens
- Does NOT make a network request (local scope only)

The updated `useEffect` on mount:

```text
useEffect(() => {
  if (!user) {
    // Force local sign-out to clear any corrupt/stale tokens
    // This stops the auto-refresh retry loop
    supabase.auth.signOut({ scope: 'local' });
  }
}, [user]);
```

This is a single-line change that fully resets the client state, unlike the current approach which only clears localStorage while the client still holds the bad token in memory.

No other files need to change.
