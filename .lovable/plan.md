
# Fix AISensy Account Dropdown and Webhook Fallback

## Problem 1: Only one AISensy account showing in dropdown

When you add a second AISensy account, the system saves it with a unique `integration_type` like `aisensy_1772176788174` (with a timestamp suffix), not just `aisensy`. The settings page correctly uses `.startsWith("aisensy")` to find all accounts, but the Create Broadcast dialog uses `.eq("integration_type", "aisensy")` which only matches the first one exactly.

**Fix:** Change the query in `CreateBroadcastDialog.tsx` to use `.like("integration_type", "aisensy%")` instead of `.eq("integration_type", "aisensy")` so it picks up all AISensy accounts regardless of suffix.

The same fix is needed in the `bolna-webhook` fallback path (when no specific account is selected), which also uses `.eq("integration_type", "aisensy")`.

## Problem 2: No template dropdown

AISensy does not provide a public API to list your templates. So we cannot fetch templates automatically. The current manual text input for template name will remain -- you need to type the exact template name as it appears in your AISensy dashboard.

However, I can improve the UX by adding a helper text that makes this clearer.

## Files Changed

| File | Change |
|------|--------|
| `src/pages/calling/CreateBroadcastDialog.tsx` | Change `.eq("integration_type", "aisensy")` to `.like("integration_type", "aisensy%")` |
| `supabase/functions/bolna-webhook/index.ts` | Same filter fix in the fallback query path |
