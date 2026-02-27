

# Fix: Use Correct AISensy API Key from Database

## Root Cause

The `send-whatsapp-link` function uses `AISENSY_API_KEY` from environment secrets, but the "Bolna ai bot" campaign exists under the **"Aisency free account"** stored in the database (`organization_integrations` table). Different API key = "Campaign does not exist" error.

## Template Confirmation

The template screenshot confirms the original parameter mapping is correct:
- {{1}} = Lead name
- {{2}} = Workshop name
- {{3}} = Date/time
- {{4}} = WhatsApp group link

No changes needed to `templateParams`.

## Fix in `supabase/functions/send-whatsapp-link/index.ts`

Instead of reading from `AISENSY_API_KEY` env secret, the function will:

1. Import the Supabase client (using `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` env vars)
2. Query `organization_integrations` for the "Aisency free account" record (integration ID: `459398a2-dae8-4a20-a4cb-de87cc4add1b`)
3. Use the `api_key` from its `config` JSONB column

The query approach will be flexible -- Bolna can optionally pass an `aisensy_integration_id` in the request body. If not provided, the function falls back to the known free account integration ID.

### Code changes (single file)

```text
Before:
  const apiKey = Deno.env.get("AISENSY_API_KEY");

After:
  // Create Supabase client
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Look up the AISensy free account from the database
  const integrationId = body.aisensy_integration_id 
    || "459398a2-dae8-4a20-a4cb-de87cc4add1b";

  const { data: integration, error: intError } = await supabase
    .from("organization_integrations")
    .select("config")
    .eq("id", integrationId)
    .single();

  const apiKey = integration?.config?.api_key;
```

This approach:
- Uses the correct API key from the database (the free account ending in `sHH0`)
- Keeps everything else the same (templateParams, media, campaignName)
- Allows future flexibility if you want to switch AISensy accounts per campaign

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/send-whatsapp-link/index.ts` | Fetch API key from database instead of env secret |

