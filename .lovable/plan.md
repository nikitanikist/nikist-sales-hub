

# Fix: Remove Non-Existent `uses_env_secrets` Column Reference

## Problem

The `start-voice-campaign` edge function queries:
```
.select("config, uses_env_secrets")
```

But `uses_env_secrets` does NOT exist as a column in `organization_integrations`. The actual columns are: `id`, `organization_id`, `integration_type`, `config`, `is_active`, `created_at`, `updated_at`, `integration_name`.

This causes the query to return a 400 error, `integration` becomes null, and the function returns "Bolna integration not configured" even though the integration exists and is active.

## Root Cause

Fix 10 from the audit report assumed `uses_env_secrets` existed. It does not. All Bolna credentials are stored directly in the `config` JSONB column (e.g., `config.api_key`).

## Fix

### File: `supabase/functions/start-voice-campaign/index.ts`

1. Change the select from `"config, uses_env_secrets"` back to just `"config"`
2. Remove the `uses_env_secrets` conditional logic and always read `config.api_key` directly

```text
BEFORE (lines 48, 60-62):
  .select("config, uses_env_secrets")
  ...
  const bolnaApiKey = integration.uses_env_secrets
    ? Deno.env.get(config.api_key_secret || "") || ""
    : config.api_key || "";

AFTER:
  .select("config")
  ...
  const bolnaApiKey = config.api_key || "";
```

### Also fix: `supabase/functions/stop-voice-campaign/index.ts`

Check if the same `uses_env_secrets` reference exists there and fix it too, since the column doesn't exist.

### Also fix: `supabase/functions/bolna-webhook/index.ts`

Same check -- remove any `uses_env_secrets` references.

## Deploy

Redeploy all three edge functions after the fix.

