

# Fix: Add Organization ID to Pabbly Status Webhook Payload

## What's Happening
When a closer changes a call status on their assigned calls page, the app sends the update to the `send-status-to-pabbly` backend function. But it's not including the organization ID, so the function can't find the correct webhook URL in the database and falls back to a now-deleted environment variable.

## The Fix
One file, one change: add `organization_id` to the webhook payload in `src/pages/CloserAssignedCalls.tsx`.

## Technical Details

**File:** `src/pages/CloserAssignedCalls.tsx`

In the `basePayload` object (around line 680), add `organization_id: organization?.id`. The component already imports and uses the `useOrganization` hook, so no new imports are needed.

This ensures both the "NEW workflow" and "OLD workflow" Pabbly calls (lines 710 and 726) include the organization ID, allowing the backend function to look up the active outgoing webhook from the database.

## No Other Files Need Changes
- `AllCloserCalls.tsx` does **not** call the Pabbly webhook, so no changes there
- The backend function already supports `organization_id` — no changes needed
- The database webhook record is already configured and active

