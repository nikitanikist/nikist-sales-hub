
# Use Dedicated Secret for Bolna WhatsApp Link Function

## The Problem

Currently `send-whatsapp-link` uses `WEBHOOK_SECRET_KEY` — the same secret protecting your other WhatsApp webhook functions. Since this secret will be visible in plain text in the Bolna dashboard config, it should be a separate, unique value.

## Changes

### 1. Add New Secret: `BOLNA_WH_LINK_SECRET`

Create a new dedicated secret with a random value (e.g., `bolna-wh-link-x8k2m9p4`) that is only used by this one function.

### 2. Update `supabase/functions/send-whatsapp-link/index.ts`

Change line 19 from:
```typescript
const expectedSecret = Deno.env.get("WEBHOOK_SECRET_KEY");
```
to:
```typescript
const expectedSecret = Deno.env.get("BOLNA_WH_LINK_SECRET");
```

That's the only code change needed. Everything else stays the same.

### 3. Share with Senior Developer

After deployment, provide:
- **Function URL**: `https://swnpxkovxhinxzprxviz.supabase.co/functions/v1/send-whatsapp-link`
- **The secret value** set for `BOLNA_WH_LINK_SECRET`

They will use it in the Bolna custom function config:
```json
"param": {
    "webhook_secret": "<the-bolna-wh-link-secret-value>",
    "whatsapp_number": "%(whatsapp_number)s",
    ...
}
```

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/send-whatsapp-link/index.ts` | Replace `WEBHOOK_SECRET_KEY` with `BOLNA_WH_LINK_SECRET` |
| New secret | Add `BOLNA_WH_LINK_SECRET` with a unique random value |
