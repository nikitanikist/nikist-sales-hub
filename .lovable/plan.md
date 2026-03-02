

## Fix: CSV Column Parsing and Preview in Calling Agent Dialog

### Problem
The CSV column detection logic (`h.includes("name")`) matches `class_name` before `lead_name`, causing the wrong column to display as the contact name. Additionally, the preview table only shows Name and Phone, hiding important context columns like `class_name` and `event_date`.

### Changes

**File: `src/pages/calling-agent/CreateAgentCampaignDialog.tsx`**

1. **Fix name column detection** -- Prioritize `lead_name` or `contact_name` over generic "name" matches. Use a two-pass approach:
   - First, look for exact matches: `lead_name`, `contact_name`, `customer_name`
   - Only fall back to generic `includes("name")` if no exact match found, and exclude columns like `class_name`, `event_name`, `workshop_name`

2. **Show all CSV columns in the preview table** -- Instead of only showing Name and Phone, display all columns from the CSV (contact_number, class_name, lead_name, event_date, etc.) so the user can verify everything was parsed correctly. This matches what the user expects to see before launching the campaign.

3. **Store all non-phone columns as context** -- Currently, both `name` and extra columns are separated. Instead, store ALL non-phone columns (including lead_name) in the `context_details` so that the Bolna CSV generation in the edge function includes every column the agent needs as prompt variables.

### Technical Details

- Update the `nameIdx` detection at line 68 to use a priority-based matching:
  ```
  Priority 1: "lead_name", "contact_name", "customer_name" (exact match)
  Priority 2: columns containing "name" but NOT "class_name", "event_name", "workshop_name"
  ```

- Update the Step 3 preview table (lines 257-280) to dynamically render all CSV headers as columns instead of hardcoded Name/Phone

- Keep the `Contact` interface but add a `rawColumns` field to preserve original CSV column order for display

### No backend changes needed
The edge function (`start-calling-agent-campaign`) already correctly reads all keys from `context_details` and builds the CSV dynamically (lines 102-120), so it will automatically include `class_name`, `lead_name`, `event_date` etc. in the Bolna batch CSV.

