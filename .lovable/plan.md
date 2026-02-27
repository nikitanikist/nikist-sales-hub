

# Add `whatsapp_number` Column to Bolna CSV

## Summary

Add `whatsapp_number` as a new column in the CSV sent to Bolna, containing the same phone number as `contact_number`. This allows the Bolna prompt to use `{{whatsapp_number}}` as a separate variable (e.g., for telling the person their WhatsApp number).

## Change

**File: `supabase/functions/start-voice-campaign/index.ts`**

- Update CSV header from:
  `contact_number,lead_name,workshop_time,workshop_name,call_id`
  to:
  `contact_number,lead_name,workshop_time,workshop_name,call_id,whatsapp_number`

- Append the same phone number at the end of each CSV row (duplicating `contact_number`)

That's it -- one file, two lines changed. The function will be redeployed automatically.

## Updated Bolna Variable Reference

| CSV Column | Bolna Variable | Source |
|---|---|---|
| contact_number | %(contact_number)s | Phone from contacts |
| lead_name | %(lead_name)s | Name from contacts |
| workshop_time | %(workshop_time)s | User input in step 2 |
| workshop_name | %(workshop_name)s | User input in step 2 |
| call_id | %(call_id)s | Internal record UUID |
| whatsapp_number | %(whatsapp_number)s | Same as contact_number |

