

# Create Community/Group Dialog on WhatsApp Dashboard

## Overview

Add a "Create" button to the WhatsApp Dashboard that opens a dialog for creating WhatsApp Communities or Groups directly from the CRM.

## VPS Requirement

The current VPS (72.61.251.65:3000) supports `/create-community` but does **not** have a `/create-group` endpoint. Two options:

1. **Phase 1 (this plan):** Build the full UI with both Community and Group options, but only Community creation will work end-to-end. Group creation will show a "Coming Soon" state until the VPS developer adds a `/create-group` endpoint.
2. Alternatively, the VPS developer can add `POST /create-group` accepting `{ sessionId, name, description?, participants?: string[] }` and returning `{ success, groupId, inviteLink }`. Once available, we just wire it in.

**No VPS changes are needed for Community creation -- it already works.**

## New Component: `CreateGroupDialog.tsx`

A dialog with the following flow:

### Fields
1. **Type selector** -- Radio group: "Community" or "Group"
2. **WhatsApp Number** -- Dropdown of connected sessions (pre-selected if only one)
3. **Template** (Community only) -- Optional dropdown fetching from `community_templates` table. Selecting a template auto-fills name/description
4. **Name** -- Text input (manual entry or auto-filled from template)
5. **Description** -- Textarea (manual entry or auto-filled from template)
6. **Settings toggles** (Community only):
   - "Announcement only" (only admins can send) -- default OFF
   - "Restrict settings" (only admins can edit) -- default OFF
7. **Create button** -- Triggers creation

### After Creation
- Show a success state with the invite link displayed and a "Copy" button
- Invalidate `whatsapp-groups` query to refresh the dashboard table

## Implementation Details

### Edge Function Changes

The existing `create-whatsapp-community` edge function is workshop-specific (requires `workshopId`). For standalone creation from the dashboard, we'll use the `vps-whatsapp-proxy` which already has a `create-community` action. We need to extend it slightly:

- Pass `announcement` and `restrict` settings from the dialog (currently hardcoded to `true`)
- Pass `profilePictureUrl` and `adminNumbers` from org settings
- After VPS returns success, insert the group into `whatsapp_groups` table
- Return the invite link

We'll add a new `create-community-standalone` action to the proxy that handles DB insertion (the current `create-community` action just forwards to VPS without saving).

### Files to Create
| File | Purpose |
|------|---------|
| `src/components/whatsapp/CreateGroupDialog.tsx` | The dialog component |

### Files to Modify
| File | Change |
|------|--------|
| `src/pages/whatsapp/WhatsAppDashboard.tsx` | Add "Create" button next to "Send Notification", import and render dialog |
| `supabase/functions/vps-whatsapp-proxy/index.ts` | Add `create-community-standalone` action that creates community via VPS, inserts into `whatsapp_groups`, and returns invite link |

### No Database Changes Required
The `whatsapp_groups` table already has all needed columns.

## Technical Flow

1. User clicks "Create" on Dashboard
2. Dialog opens, user selects type, session, fills name/description, toggles settings
3. On submit, frontend calls `vps-whatsapp-proxy` with action `create-community-standalone`
4. Proxy calls VPS `/create-community` with the provided settings
5. On success, proxy inserts into `whatsapp_groups` table and returns result with invite link
6. Frontend shows success state with invite link
7. Frontend invalidates `whatsapp-groups` query to refresh the table

