
# Fix: Bolna Integration — Two Bugs

## Problem 1: "Bolna integration not configured" in Create Broadcast

The `list-bolna-agents` edge function queries the `organization_integrations` table using wrong column names:
- Uses `.eq("type", "bolna")` but the column is `integration_type`
- Selects `uses_env_secrets` which doesn't exist in the table

This causes the query to return no results, triggering the "not configured" error even though the Bolna integration exists in the database with a valid API key.

**Fix**: Update `supabase/functions/list-bolna-agents/index.ts`:
- Change `.eq("type", "bolna")` to `.eq("integration_type", "bolna")`
- Remove `uses_env_secrets` from the select and simplify the API key resolution to just read `config.api_key` directly (matching how the integration is stored)

## Problem 2: "Unknown integration type" when testing connection

The `TestConnectionButton` component has cases for zoom, calendly, whatsapp, and aisensy, but no `case "bolna"`. When you click "Test Connection" for a Bolna integration, it falls through to the `default` case which throws "Unknown integration type".

**Fix**: Add a `case "bolna"` block in `src/components/settings/TestConnectionButton.tsx` that:
- Validates the `api_key` field is present
- Calls the `list-bolna-agents` edge function to verify the API key works
- Shows success with the number of agents found, or an error if the call fails

## Files Changed

1. `supabase/functions/list-bolna-agents/index.ts` — Fix column names in database query
2. `src/components/settings/TestConnectionButton.tsx` — Add Bolna test connection handler
