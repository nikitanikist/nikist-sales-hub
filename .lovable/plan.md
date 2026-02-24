

# Fix: Community Admin Numbers Not Being Sent During Standalone Community Creation

## Root Cause

There are two separate community creation flows:

1. **Workshop-triggered** (`create-whatsapp-community` edge function) -- This one correctly fetches `community_admin_numbers` from the organization settings and passes them as `adminNumbers` to the VPS. The VPS then sends invite messages to those numbers and auto-promotes them to admin when they join.

2. **Standalone creation** (`vps-whatsapp-proxy` with action `create-community-standalone`) -- This is the flow used when you manually create a community from the WhatsApp module. This flow does **NOT** fetch the `community_admin_numbers` from the organization and does **NOT** pass `adminNumbers` to the VPS create-community endpoint. That is why no invite messages are being sent to the configured admin numbers.

## Fix

Modify the `create-community-standalone` case in the `vps-whatsapp-proxy` edge function to:

1. Fetch `community_admin_numbers` from the `organizations` table using the provided `organizationId`
2. Include those numbers as `adminNumbers` in the VPS `/create-community` request body (matching what `create-whatsapp-community` already does)
3. Return the `adminInvitesSent` and `adminNumbersInvited` fields from the VPS response so the frontend can confirm

## Technical Details

**File:** `supabase/functions/vps-whatsapp-proxy/index.ts`

In the `create-community-standalone` case (around line 574):

- Before making the VPS call, query:
  ```sql
  SELECT community_admin_numbers FROM organizations WHERE id = organizationId
  ```
- Add `adminNumbers` to the VPS request body alongside `sessionId`, `name`, `description`, and `settings`
- Include `adminInvitesSent` and `adminNumbersInvited` in the success response returned to the frontend

No frontend changes are needed -- the fix is entirely in the backend function.

