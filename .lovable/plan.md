

# Hardcode Workshop Time to "Today 7 PM"

## Change

In `supabase/functions/send-whatsapp-link/index.ts`, line 36:

```text
Before:
const workshopTime = body.workshop_time || "Today";

After:
const workshopTime = "Today 7 PM";
```

This ignores whatever Bolna sends for `workshop_time` and always uses "Today 7 PM", so the WhatsApp message will read: *"scheduled on **Today 7 PM**"* instead of just "7".

## File Changed

| File | Change |
|------|--------|
| `supabase/functions/send-whatsapp-link/index.ts` | Hardcode `workshopTime` to `"Today 7 PM"` |

Single line change, then redeploy the function.

