
# Verify AISensy Template Feature

## What This Does
Adds a "Verify Template" button next to the template name input in Step 3 of Create Broadcast. When clicked, it calls an edge function that tests the campaign name against your selected AISensy account's API key.

## How It Works (Technical)

AISensy has no "list templates" API, but their send API returns specific errors:
- If the campaign name doesn't exist, it returns an error indicating "campaign not found"
- If the parameter count is wrong, it tells us the expected count

We'll use this behavior to verify templates.

### Files to Create/Modify

**1. New Edge Function: `supabase/functions/verify-aisensy-template/index.ts`**
- Accepts: `integrationId` (to fetch the API key from DB) and `campaignName`
- Fetches the AISensy API key from `organization_integrations` using the integration ID
- Sends a test request to `https://backend.aisensy.com/campaign/t1/api/v2` with:
  - The API key
  - The campaign name
  - A dummy destination (e.g., `+910000000000`) 
  - Empty templateParams
- Parses the response:
  - Success or "invalid destination" = campaign exists
  - "campaign not found" type error = campaign doesn't exist
  - "wrong params count" type error = campaign exists, and we can extract expected param count
- Returns verification result: `{ exists: boolean, paramCount?: number, message: string }`

**2. Modify: `src/pages/calling/CreateBroadcastDialog.tsx`**
- Add a "Verify Template" button next to the template name input
- On click, calls the edge function with the selected AISensy account ID and template name
- Shows verification result:
  - Green checkmark + "Template verified" if found
  - Red X + "Template not found" if not found  
  - Shows expected parameter count if detected (e.g., "This template expects 3 variables")
- Button shows loading spinner while verifying

**3. Update: `supabase/config.toml`** (if needed)
- Add `verify_jwt = false` for the new function

## Limitations
- AISensy's error messages may not always clearly indicate the exact number of parameters -- we'll extract what we can
- We cannot get the actual variable *names* (like "name", "link", "date") since AISensy uses positional parameters ({{1}}, {{2}}, etc.), not named variables
- The verification uses AISensy's send endpoint with a dummy number, so no actual message is sent

## User Experience
In Step 3, after typing the template name and selecting an AISensy account:
1. Click "Verify Template"
2. See a loading state for 1-2 seconds
3. Get confirmation: "Template 'welcome_av8' verified -- expects 5 parameters" (with a green badge)
4. Or error: "Template 'welcome_av8' not found in this AISensy account" (with a red badge)
