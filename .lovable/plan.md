

# Add Call Time to Pabbly Webhook Payload

## Summary

Add the `call_time` field (from the existing `scheduled_time` column) to the Pabbly webhook payload so you can use both date and time in your Pabbly automations (e.g., "Your call was on Feb 15 at 2:30 PM").

## What Changes

### File: `src/pages/CloserAssignedCalls.tsx`

One line added to the `basePayload` object at ~line 687:

```
call_time: freshAppointment.scheduled_time
```

The payload will go from:
```
call_date: freshAppointment.scheduled_date,
closer_name: closer?.full_name || 'Unknown'
```
to:
```
call_date: freshAppointment.scheduled_date,
call_time: freshAppointment.scheduled_time,
closer_name: closer?.full_name || 'Unknown'
```

## What Does NOT Change

- No database changes -- `scheduled_time` already exists
- No edge function changes -- `send-status-to-pabbly` forwards the full payload as-is
- No other files, pages, or features are touched
- All existing statuses (Converted, Not Converted, etc.) continue working exactly as before -- this is purely an additional field

## After Deployment

You will need to **re-capture the webhook response once** in Pabbly to see the new `call_time` field (value format: `"14:30:00"`). Then map it in your message templates.

