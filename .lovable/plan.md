
# Fix: start-voice-campaign Edge Function — Same Column Name Bug

## Problem

The `start-voice-campaign` edge function has the identical bug we just fixed in `list-bolna-agents`:
- Line 50: `.eq("type", "bolna")` should be `.eq("integration_type", "bolna")`
- Line 48: selects `uses_env_secrets` which doesn't exist in the table

Because of this, the function can't find your Bolna integration, returns an error, and the campaign stays in "draft" status. The frontend shows a success toast for campaign creation but logs the start failure separately — so it appears to succeed but nothing actually happens.

## Fix (1 file)

**`supabase/functions/start-voice-campaign/index.ts`** (lines 46-68):

1. Change `.eq("type", "bolna")` to `.eq("integration_type", "bolna")`
2. Remove `uses_env_secrets` from the select
3. Simplify API key resolution to read `config.api_key` directly (same pattern as the list-bolna-agents fix)

```typescript
// Before (broken):
.select("config, uses_env_secrets")
.eq("type", "bolna")

// After (fixed):
.select("config")
.eq("integration_type", "bolna")
```

And simplify the key resolution:
```typescript
const bolnaApiKey = config.api_key || "";
const bolnaAgentId = campaign.bolna_agent_id || config.agent_id || "";
```

## Expected Result

After deploying, creating a broadcast and clicking start will correctly find the Bolna integration, create the batch via Bolna API, and transition the campaign from "draft" to "running" with calls moving to "queued" status.
