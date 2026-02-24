

# Fix: Login Stuck on "Signing in..." Forever

## The Problem

The "Sign In" button stays stuck on "Signing in..." because the authentication request never completes. The network requests show repeated "Failed to fetch" errors to the backend, meaning the request hangs indefinitely and the button never resets.

## Root Causes

1. **No timeout on sign-in**: If the network request hangs (no response at all), the `await signIn()` never resolves, so `setLoading(false)` in the `finally` block never runs. The button stays disabled with "Signing in..." forever.

2. **Stale service worker interference**: The PWA service worker caches all JS/CSS/HTML files but doesn't exclude backend API requests from its navigation fallback. A stale or misconfigured service worker can interfere with fetch requests to the auth endpoint.

3. **Stale refresh token loop**: There's an invalid refresh token (`ddifeamml345`) stored in localStorage that keeps failing. This creates a background retry loop that may interfere with new login attempts.

## The Fix

### 1. Add a timeout to the sign-in request

**File: `src/pages/Auth.tsx`**

Wrap the `signIn` call with a timeout (15 seconds). If the request doesn't complete in time, show an error message and reset the button so the user can try again.

```text
BEFORE:
  const { error } = await signIn(email, password);

AFTER:
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error("Request timed out")), 15000)
  );
  const { error } = await Promise.race([signIn(email, password), timeoutPromise]);
```

### 2. Clear stale auth state on the login page

**File: `src/pages/Auth.tsx`**

When the Auth page mounts (and the user is not already logged in), clear any stale Supabase session from localStorage. This prevents the background refresh loop from interfering with fresh login attempts.

### 3. Exclude auth API from service worker caching

**File: `vite.config.ts`**

Add `navigateFallbackDenylist` to the workbox config to ensure the service worker never intercepts requests to the Supabase auth endpoints:

```text
workbox: {
  navigateFallbackDenylist: [/^\/auth/, /supabase/],
  ...existing config
}
```

### 4. Add a "retry" fallback on the login page

**File: `src/pages/Auth.tsx`**

If sign-in fails due to a network error or timeout, show a helpful message like "Connection failed. Please check your internet and try again." with the button re-enabled so the user can retry immediately.

## Files to Change

- **`src/pages/Auth.tsx`** -- Add timeout, stale session cleanup, better error messages
- **`vite.config.ts`** -- Add `navigateFallbackDenylist` for auth/API routes

