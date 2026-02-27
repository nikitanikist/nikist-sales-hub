

# Add Webhook Secret Validation to `send-whatsapp-link`

## What Changes

Add a `WEBHOOK_SECRET_KEY` check at the top of the function, reading the secret from `body.webhook_secret` (since Bolna can only pass it as a param field, not a header).

## File: `supabase/functions/send-whatsapp-link/index.ts`

After parsing the JSON body (line 16-17), add a webhook secret check **before** any other processing:

```typescript
// Right after: const body = await req.json();

const expectedSecret = Deno.env.get("WEBHOOK_SECRET_KEY");
if (!expectedSecret || body.webhook_secret !== expectedSecret) {
  console.error("Unauthorized: invalid or missing webhook_secret");
  return new Response(
    JSON.stringify({ error: "Unauthorized" }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

Also sanitize the log on line 17 so it doesn't print the webhook secret to logs:

```typescript
const { webhook_secret, ...safeBody } = body;
console.log("Received from Bolna:", JSON.stringify(safeBody));
```

The `WEBHOOK_SECRET_KEY` secret is already configured in the environment, so no new secrets are needed.

## Bolna Config (for your senior developer)

Once deployed, the Bolna custom function param should include:

```json
"param": {
    "webhook_secret": "<your-webhook-secret-value>",
    "whatsapp_number": "%(whatsapp_number)s",
    "lead_name": "%(lead_name)s",
    "workshop_name": "%(workshop_name)s",
    "workshop_time": "%(workshop_time)s"
}
```

## Summary

| File | Change |
|------|--------|
| `supabase/functions/send-whatsapp-link/index.ts` | Add `body.webhook_secret` validation + sanitize logs |

No database changes. No UI changes. No new secrets needed.

