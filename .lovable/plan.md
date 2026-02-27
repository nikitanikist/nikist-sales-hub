

# Create `send-whatsapp-link` Edge Function for Bolna

## Background

Bolna voice agents cannot substitute variables inside nested JSON structures (like `templateParams` arrays). After extensive testing with 4 different approaches, the only working solution is a middleman edge function that receives **flat key-value params** from Bolna and constructs the full nested AiSensy payload server-side.

## What Will Be Created

### 1. New Edge Function: `supabase/functions/send-whatsapp-link/index.ts`

A simple, public endpoint (no JWT -- Bolna can't send auth headers) that:

- Receives flat JSON from Bolna: `{ whatsapp_number, lead_name, workshop_name, workshop_time }`
- Cleans the phone number (removes `+`, ensures `91` prefix)
- Constructs the full AiSensy payload with `templateParams`, `media`, `userName`, etc.
- Calls AiSensy API and returns the result
- Uses `Deno.env.get("AISENSY_API_KEY")` for the API key (already configured as a secret)
- Includes a configurable `whatsapp_group_link` with a default fallback URL
- Uses `fetchWithRetry` (existing shared utility) for reliable AiSensy calls

**Security**: Protected by a `WEBHOOK_SECRET_KEY` check -- Bolna will send this as a header or param. The API key is stored as an environment secret, never hardcoded.

**Template params mapping** (matching your "Bolna ai bot" template):
- `{{1}}` = lead_name (fallback: "Friend")
- `{{2}}` = workshop_name (fallback: "Workshop")
- `{{3}}` = workshop_time (fallback: "Today")
- `{{4}}` = whatsapp_group_link (fallback: configurable default URL)

### 2. Update `supabase/config.toml`

Add the new function with `verify_jwt = false`.

### 3. Bolna Configuration (for your reference)

After deployment, configure Bolna's custom function tool with:
- URL: `https://swnpxkovxhinxzprxviz.supabase.co/functions/v1/send-whatsapp-link`
- Flat `param` body with `%(variable)s` substitution
- No auth token needed (function validates via webhook secret or is open)

## Technical Details

| Item | Detail |
|------|--------|
| Function name | `send-whatsapp-link` |
| Auth | `verify_jwt = false` (Bolna can't send JWT) |
| API key source | `AISENSY_API_KEY` env secret (already configured) |
| AiSensy endpoint | `https://backend.aisensy.com/campaign/t1/api/v2` |
| Campaign name | Passed by Bolna or defaults to "Bolna ai bot" |
| Media | Hardcoded image URL from the template |
| Phone format | Strips `+`, ensures `91` prefix |
| Retry | Uses existing `fetchWithRetry` with 10s timeout |

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/send-whatsapp-link/index.ts` | **New** -- middleman edge function |
| `supabase/config.toml` | Add `[functions.send-whatsapp-link]` with `verify_jwt = false` |

## What This Does NOT Change

- The existing `bolna-webhook` function remains untouched (it handles post-call webhooks and other tool calls)
- No database changes needed
- No UI changes needed -- this is a backend-only function called by Bolna

