

# Add AISensy Account Selection to Voice Campaigns

## What This Does

When creating a calling broadcast, you'll be able to:
1. **Select which AISensy account** to use for sending WhatsApp messages
2. **Pick a template from a dropdown** instead of typing it manually
3. When the AI agent hears "I'm not in the WhatsApp group," it will automatically send the selected template from the chosen AISensy account

## Current Flow (What Exists)

- Step 3 of "Create Broadcast" has a free-text input for "AiSensy WhatsApp Template"
- The webhook (`bolna-webhook`) picks the **first** active AISensy integration and sends the template
- No way to choose which AISensy account to use

## Changes

### 1. UI: Replace free-text with AISensy account + template selector (Step 3)

**File: `src/pages/calling/CreateBroadcastDialog.tsx`**

- Add state for `aisensyIntegrationId` (selected AISensy account)
- Fetch all active AISensy integrations for the org on step 3
- Show a dropdown to pick which AISensy account
- Once an account is selected, fetch its templates via AISensy API (or keep the manual template name input if the AISensy API doesn't support listing templates -- we'll keep the manual input since AISensy doesn't have a template listing API, but add the account selector)
- Store the selected `aisensy_integration_id` along with the template name when creating the campaign

### 2. Database: Add `aisensy_integration_id` to `voice_campaigns`

Add a nullable UUID column `aisensy_integration_id` to the `voice_campaigns` table so the webhook knows exactly which AISensy account to use.

```sql
ALTER TABLE voice_campaigns 
ADD COLUMN aisensy_integration_id uuid REFERENCES organization_integrations(id);
```

### 3. Update campaign creation hook

**File: `src/hooks/useCreateBroadcast.ts`**

- Accept and pass `aisensy_integration_id` when inserting the campaign

### 4. Update types

**File: `src/types/voice-campaign.ts`**

- Add `aisensy_integration_id: string | null` to `VoiceCampaign` interface
- Add `aisensy_integration_id?: string` to `CreateBroadcastData`

### 5. Update webhook to use the selected AISensy account

**File: `supabase/functions/bolna-webhook/index.ts`**

In the `send_whatsapp_group_link` tool handler (line ~96-134):
- Read `aisensy_integration_id` from the campaign's joined data
- If set, fetch that specific integration by ID instead of querying by org + type
- If not set, fall back to the current behavior (first active AISensy integration)

```text
BEFORE:
  .eq("organization_id", orgId)
  .eq("integration_type", "aisensy")
  .eq("is_active", true)
  .single();

AFTER:
  // If campaign has a specific AISensy integration selected, use it
  if (campaign.aisensy_integration_id) {
    query = query.eq("id", campaign.aisensy_integration_id);
  } else {
    query = query.eq("organization_id", orgId)
      .eq("integration_type", "aisensy")
      .eq("is_active", true);
  }
  .single();
```

### 6. Update the campaign select query in webhook

The webhook currently selects `voice_campaigns!inner(organization_id, workshop_id, whatsapp_template_id)`. Update to also include `aisensy_integration_id`.

## Flow After Changes

1. User creates a calling broadcast
2. Step 3: User picks an AISensy account from dropdown + enters template name
3. Campaign is saved with `aisensy_integration_id` and `whatsapp_template_id`
4. During the call, if a lead says "I'm not in the WhatsApp group":
   - Bolna AI triggers `send_whatsapp_group_link` tool call
   - Webhook reads the campaign's `aisensy_integration_id`
   - Fetches that specific AISensy account's API key
   - Sends the configured template with the WhatsApp group link to the lead's phone
   - Marks `whatsapp_link_sent = true` on the call record

## Summary of Files Changed

| File | Change |
|------|--------|
| Database migration | Add `aisensy_integration_id` column |
| `src/pages/calling/CreateBroadcastDialog.tsx` | Add AISensy account dropdown in Step 3 |
| `src/types/voice-campaign.ts` | Add field to interfaces |
| `src/hooks/useCreateBroadcast.ts` | Pass new field on insert |
| `supabase/functions/bolna-webhook/index.ts` | Use selected AISensy account |

