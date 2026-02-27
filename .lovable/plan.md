
# Create `reschedule-lead` Edge Function

## What This Does

Creates a standalone backend function that Bolna's AI agent can call when a person says they want to reschedule. It receives the phone number and preferred reschedule day, finds the matching call record, and updates it with "rescheduled" status.

## How It Works

1. Bolna sends a request with `phone_number` (from CSV), `reschedule_day` (extracted by the AI from conversation), and `webhook_secret` (for security)
2. The function validates the secret (same `BOLNA_WH_LINK_SECRET` used by `send-whatsapp-link`)
3. It finds the most recent non-terminal call record matching that phone number
4. Updates the record with `outcome = "rescheduled"` and the `reschedule_day` value

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/reschedule-lead/index.ts` | **Create** -- New edge function |
| `supabase/config.toml` | **Modify** -- Add `verify_jwt = false` entry |

## Technical Details

### New Function: `reschedule-lead/index.ts`

- Validates `webhook_secret` against `BOLNA_WH_LINK_SECRET` (same pattern as `send-whatsapp-link`)
- Cleans phone number (strips `+`, ensures `91` prefix) and tries multiple formats to match
- Queries `voice_campaign_calls` for the most recent call that is NOT in a terminal state (`completed`, `no-answer`, `busy`, `failed`, `cancelled`)
- Updates the matched record: `outcome = "rescheduled"`, `reschedule_day = <value from Bolna>`
- Returns success with the matched call ID, or appropriate error if no match found
- No new secrets needed -- reuses existing `BOLNA_WH_LINK_SECRET`

### Bolna Configuration (Manual Step After Deployment)

You'll configure a new `custom_task` tool in Bolna pointing to:
```
https://swnpxkovxhinxzprxviz.supabase.co/functions/v1/reschedule-lead
```

With this parameter config (as your senior dev specified):
```json
{
  "parameters": {
    "type": "object",
    "properties": {
      "reschedule_day": {
        "type": "string",
        "description": "The day the person wants to reschedule to"
      }
    }
  },
  "value": {
    "param": {
      "webhook_secret": "<your secret>",
      "phone_number": "%(whatsapp_number)s",
      "reschedule_day": "%(reschedule_day)s"
    }
  }
}
```

### Important Note

As your senior dev mentioned, we should confirm `send-whatsapp-link` logs show flat param substitution is working before testing this function. Both functions use the same pattern.
