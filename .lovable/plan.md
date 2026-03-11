

# Improve IVR Campaign Creation Dialog

## Two Features

### 1. Audio Preview Button
Add a play/pause button next to the audio clip dropdown so users can listen to the selected clip before proceeding.

**File: `src/pages/ivr/CreateIvrCampaignDialog.tsx`**
- Add an `audioRef` using `useRef<HTMLAudioElement>` and `isPlaying` state
- Render a play/pause icon button inline next to the Select dropdown (using a flex row)
- When clicked, play/pause the selected clip's `audio_url`
- Disable the button when no clip is selected

### 2. Phone Number Selection
Replace the single `from_number` in VoBiz settings with a comma-separated list of numbers, and add a phone number dropdown in the campaign creation dialog.

**File: `src/components/settings/AddIntegrationDialog.tsx`**
- Change the `from_number` field label to "From Numbers (comma-separated)" with placeholder "+919240024247, +917971543229"

**File: `src/pages/ivr/CreateIvrCampaignDialog.tsx`**
- Add `selectedFromNumber` state
- Parse `vobizConfig.from_number` by splitting on commas to get a list of numbers
- Add a "From Number" Select dropdown in Step 2 (after CSV upload) showing all available numbers
- If only one number exists, auto-select it
- Pass `selectedFromNumber` as `vobiz_from_number` when creating the campaign

**File: `supabase/functions/process-ivr-queue/index.ts`**
- No changes needed — it already reads `campaign.vobiz_from_number` per-campaign, which will now be the specific number chosen during creation

### Review Step
- Add the selected phone number to the Step 3 review summary

