

# Route All Traffic Through Cloudflare Proxy (`api.tagfunnel.ai`)

## Problem

The auto-generated files `src/integrations/supabase/client.ts` and `.env` cannot be manually edited in Lovable -- they get overwritten. But we need all 86 files that import the Supabase client to use `https://api.tagfunnel.ai` instead of `https://swnpxkovxhinxzprxviz.supabase.co`.

## Solution: Vite Alias Override (zero import changes needed)

We use a **Vite alias** to intercept the import path. Every file in the project imports from `@/integrations/supabase/client` -- we redirect that path to a custom wrapper file that hardcodes your proxy URL. No need to touch any of the 86 importing files.

## Changes (2 files)

### 1. Create `src/lib/supabaseProxy.ts` (new file)

A drop-in replacement for the auto-generated client that:
- Hardcodes `https://api.tagfunnel.ai` as the Supabase URL
- Uses the same anon key from the environment variable
- Keeps the same auth configuration (localStorage, persistSession, autoRefreshToken)
- Exports `supabase` with the same name so all existing imports work unchanged

### 2. Update `vite.config.ts`

Add one alias entry so that:

```text
"@/integrations/supabase/client"  -->  "src/lib/supabaseProxy.ts"
```

This means when any file does `import { supabase } from "@/integrations/supabase/client"`, Vite silently loads our proxy file instead.

## What Happens

- All API calls (auth, database, realtime, edge functions) route through `api.tagfunnel.ai`
- Cloudflare proxies them to `swnpxkovxhinxzprxviz.supabase.co` transparently
- Jio/Airtel users connect without VPN or DNS changes
- Non-Jio users are unaffected (same functionality, slightly different route)
- If the auto-generated `client.ts` gets regenerated, it does not matter -- the alias skips it entirely

## Rollback

To revert, simply remove the alias line from `vite.config.ts`. Everything instantly goes back to the original Supabase URL.

