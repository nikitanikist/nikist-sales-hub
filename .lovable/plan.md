

# Fix Bolna Voice Campaign: Auto-Start and Phone Number

## Bug 1: Batch Not Auto-Starting

The current code at line 114 sets `scheduleTime` to `campaign.scheduled_at || new Date().toISOString()`, which passes "right now" as the schedule time. Bolna likely rejects or ignores a schedule time that's already in the past.

**Fix in `supabase/functions/start-voice-campaign/index.ts`:**
- Change the schedule time to 30 seconds in the future (as recommended by Bolna API)
- Add a console.log before the schedule call for debugging
- Log the schedule response body
- If the response indicates failure (state !== 'scheduled'), mark the campaign as failed

```text
// Line 114 — replace:
const scheduleTime = campaign.scheduled_at || new Date().toISOString();

// With:
const scheduleTime = campaign.scheduled_at || new Date(Date.now() + 30000).toISOString();
console.log(`Scheduling batch ${batchId} at: ${scheduleTime}`);
```

Also add response logging and error handling after the schedule call (lines 123-126): log the parsed JSON response body, and if `scheduleResult.state !== 'scheduled'`, update the campaign status to `failed`.

---

## Bug 2: Calls From Wrong Phone Number

The batch creation form data (line 91-93) doesn't include `from_phone_number`, so Bolna uses its default number.

**Fix (two parts):**

### Part A — Edge function (`start-voice-campaign/index.ts`)
After line 93, add:
```text
const fromPhone = config.from_phone_number || '';
if (fromPhone) {
  formData.append('from_phone_number', fromPhone);
}
```

### Part B — Settings UI (`src/components/settings/AddIntegrationDialog.tsx`)
Add a new field to the Bolna integration form (line 69, after webhook_secret):
```text
{ key: "from_phone_number", label: "From Phone Number", placeholder: "+917971543257", secret: false },
```

This lets each organization configure their own Bolna phone number in Settings > Integrations.

---

## Summary of Changes

| File | Change |
|------|--------|
| `supabase/functions/start-voice-campaign/index.ts` | Fix schedule time (+30s), add `from_phone_number` to batch creation, add logging |
| `src/components/settings/AddIntegrationDialog.tsx` | Add "From Phone Number" field to Bolna integration form |

