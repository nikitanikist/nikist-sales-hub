

# Fix: Edge Function 401 Authentication Error

## Problem Identified

The edge function is failing authentication because the `getClaims()` method does not exist in the Supabase JS client. The previous fix introduced an invalid method.

Looking at the logs:
- The logs show "Proxying POST request to http://72.61.251.65:3000/connect" which means the request did reach VPS
- But the 401 is being returned before that in some cases due to `getClaims` throwing an error

## Root Cause

The authentication validation is using `getClaims()` which doesn't exist. The correct approach is to use `supabase.auth.getUser()` which validates the JWT token from the Authorization header automatically when the Supabase client is initialized with that header.

## Solution

Change the authentication validation to use the simpler and correct approach:

```typescript
// Instead of manually validating the token, 
// use getUser() which works with the client's Authorization header
const { data: { user }, error: authError } = await supabase.auth.getUser();

if (authError || !user) {
  console.error('Auth validation failed:', authError);
  return new Response(
    JSON.stringify({ error: 'Unauthorized' }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

const userId = user.id;
```

## Technical Changes

### File: `supabase/functions/vps-whatsapp-proxy/index.ts`

**Lines 51-62**: Replace the broken `getClaims` call:

Before:
```typescript
const token = authHeader.replace('Bearer ', '');
const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);

if (claimsError || !claimsData?.claims) {
  console.error('Auth validation failed:', claimsError);
  return new Response(
    JSON.stringify({ error: 'Invalid token' }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

const userId = claimsData.claims.sub;
```

After:
```typescript
// The Supabase client was initialized with the Authorization header,
// so getUser() will validate the token automatically
const { data: { user }, error: authError } = await supabase.auth.getUser();

if (authError || !user) {
  console.error('Auth validation failed:', authError);
  return new Response(
    JSON.stringify({ error: 'Unauthorized' }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

const userId = user.id;
```

## Why This Works

When creating the Supabase client with:
```typescript
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: authHeader } }
});
```

The `getUser()` method automatically uses that Authorization header to validate and retrieve the user. This is the standard pattern for edge functions.

