

# Remove AISensy Step and Add Workshop Name to Bolna CSV

## Summary

Two changes: (1) Remove the now-redundant AISensy account/template selection step from the broadcast creation dialog, and (2) add `workshop_name` as a column in the CSV sent to Bolna so the calling bot can use it as a variable.

## Changes

### 1. Simplify CreateBroadcastDialog (4 steps to 3)

**File: `src/pages/calling/CreateBroadcastDialog.tsx`**

- Remove Step 3 (AISensy account selection + template verification) entirely
- Remove all AISensy-related state variables, the `fetchAisensyAccounts` function, the `handleVerifyTemplate` function, and the `AisensyAccount` interface
- Remove unused imports (`ShieldCheck`, `CheckCircle2`, `XCircle`)
- Old Step 4 (Start Now / Schedule) becomes new Step 3
- Update the step counter in the dialog title from "Step X/4" to "Step X/3"
- Update `canProceed()` logic: step 3 now handles schedule mode validation (was step 4)
- Update the "Next" button threshold from `step < 4` to `step < 3`
- Remove `whatsapp_template_id` and `aisensy_integration_id` from the `handleSubmit` payload

### 2. Add `workshop_name` to Bolna CSV

**File: `supabase/functions/start-voice-campaign/index.ts`**

- Add `workshop_name` column to the CSV header: `contact_number,lead_name,workshop_time,workshop_name,call_id`
- Include `campaign.workshop_name` (with fallback to empty string) in each CSV row
- Escape commas in workshop name (same as lead name)

After this, Bolna agents can use `%(workshop_name)s` in their prompts.

### 3. Clean up types

**File: `src/types/voice-campaign.ts`**

- Remove `whatsapp_template_id` and `aisensy_integration_id` from `CreateBroadcastData` interface (no longer needed in creation flow)

### 4. Clean up mutation hook

**File: `src/hooks/useCreateBroadcast.ts`**

- Remove `whatsapp_template_id` and `aisensy_integration_id` from the insert payload to `voice_campaigns` table

## Bolna Variable Reference (After This Change)

| CSV Column | Bolna Variable | Source |
|---|---|---|
| contact_number | %(whatsapp_number)s | Phone from contacts |
| lead_name | %(lead_name)s | Name from contacts |
| workshop_time | %(workshop_time)s | User input in step 2 |
| workshop_name | %(workshop_name)s | User input in step 2 |
| call_id | %(call_id)s | Internal record UUID |
