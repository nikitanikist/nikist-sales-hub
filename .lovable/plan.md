

# Fix: Membership Webhook 401 -- Wrong Secret Key

## Root Cause

The `whatsapp-membership-webhook` edge function validates the `x-api-key` header against the **wrong environment variable**:
- **Current (broken)**: `WHATSAPP_VPS_API_KEY` (line 62)
- **Expected (correct)**: `WEBHOOK_SECRET_KEY` (used by all other working webhooks)

The VPS sends the same API key to all webhook endpoints, but this function checks a different secret, causing the mismatch and the 401 response.

## Fix

### File: `supabase/functions/whatsapp-membership-webhook/index.ts`

Change line 62 from:
```typescript
const expectedKey = Deno.env.get("WHATSAPP_VPS_API_KEY");
```
to:
```typescript
const expectedKey = Deno.env.get("WEBHOOK_SECRET_KEY");
```

This single-line change aligns the membership webhook with the read-receipt, reaction, and error webhooks -- all of which use `WEBHOOK_SECRET_KEY` and are working correctly.

## No Other Changes Required
- No database changes
- No frontend changes
- The edge function will be automatically redeployed after the fix

