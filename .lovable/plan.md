
# Fix: AISensy Account Dropdown Shows "No accounts configured"

## Problem

The AISensy account dropdown in Step 3 of Create Broadcast shows "No AISensy accounts configured" even though accounts exist in settings. This happens because the query selects a column called `name` which doesn't exist -- the actual column is `integration_name`.

The network request returns a 400 error: `column organization_integrations.name does not exist`

## Fix

**File: `src/pages/calling/CreateBroadcastDialog.tsx`**

Two small changes:

1. **Line 87**: Change `.select("id, name")` to `.select("id, integration_name")`
2. **Line 92**: Change `d.name` to `d.integration_name` in the mapping

That's it -- once the correct column name is used, the dropdown will populate with your configured AISensy accounts.
