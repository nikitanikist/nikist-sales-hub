

# Convert Create Community/Group from Dialog to Dedicated Page

## Overview

Replace the current `CreateGroupDialog` popup with a full dedicated page at `/whatsapp/create`, following the same layout pattern as the Send Notification page. The page will feature a two-column layout with a form on the left and a live WhatsApp-style community preview on the right.

## Page Layout

```text
+------------------------------------------------------------------+
| [<- Back]   Create Community / Group                             |
+------------------------------------------------------------------+
|                                                                  |
|  LEFT COLUMN (form)              |  RIGHT COLUMN (preview)       |
|                                  |                               |
|  Type: (o) Community  ( ) Group  |  +-------------------------+  |
|                                  |  |  Community Preview      |  |
|  WhatsApp Number: [dropdown]     |  |  [profile pic circle]   |  |
|                                  |  |  Community Name          |  |
|  Template: [dropdown] (optional) |  |  Description text...    |  |
|                                  |  |  ---                    |  |
|  Profile Picture:                |  |  Announcement Group     |  |
|  [circle preview] [Upload]       |  |  (if announcement ON)   |  |
|                                  |  |  ---                    |  |
|  Name: [_______________]         |  |  Settings:              |  |
|                                  |  |  - Announcement: Yes/No |  |
|  Description: [textarea]         |  |  - Restricted: Yes/No   |  |
|                                  |  +-------------------------+  |
|  Community Settings:             |                               |
|  [toggle] Announcement only      |                               |
|    Only admins can send messages  |                               |
|                                  |                               |
|  [toggle] Restrict settings      |                               |
|    Only admins can edit community |                               |
|    name, icon, description, and   |                               |
|    create groups, add new members |                               |
|                                  |                               |
|  [Cancel]  [Create Community]    |                               |
+------------------------------------------------------------------+
```

## Changes

### 1. New Page: `src/pages/whatsapp/CreateCommunity.tsx`

A dedicated page (not a dialog) with:
- Back button navigating to `/whatsapp`
- Two-column layout (stacks vertically on mobile)
- **Left column**: All existing form fields from `CreateGroupDialog` (type selector, session dropdown, template dropdown, profile picture upload, name, description, settings toggles)
- **Right column**: A live preview card that updates as the user fills in the form, showing profile picture, name, description, and active settings
- Updated "Restrict settings" description: "Only admins can edit community name, icon, description, and create groups inside the community, add new members"
- Success state: instead of a dialog overlay, show an inline success card with the invite link and a "Copy" button, plus a "Go to Dashboard" button

### 2. Modify: `src/pages/whatsapp/WhatsAppDashboard.tsx`

- Change the "Create" button to navigate to `/whatsapp/create` instead of opening a dialog
- Remove the `CreateGroupDialog` import and state (`createOpen`)

### 3. Modify: `src/App.tsx`

- Add route: `/whatsapp/create` pointing to `CreateCommunity`
- Import the new page component

### 4. Modify: `src/pages/whatsapp/index.ts`

- Export the new `CreateCommunity` page

### 5. Delete (or keep for reference): `src/components/whatsapp/CreateGroupDialog.tsx`

- No longer needed since the page replaces it

## Preview Component

The right-side preview will be a styled card mimicking a WhatsApp community info screen:
- Circular profile picture (or placeholder icon)
- Community/Group name in bold
- Description text
- A "Settings" section showing which toggles are active
- Updates in real-time as the user types

## Files Summary

| File | Action |
|------|--------|
| `src/pages/whatsapp/CreateCommunity.tsx` | Create -- dedicated page with two-column layout |
| `src/pages/whatsapp/WhatsAppDashboard.tsx` | Edit -- navigate to `/whatsapp/create` instead of opening dialog |
| `src/pages/whatsapp/index.ts` | Edit -- export new page |
| `src/App.tsx` | Edit -- add `/whatsapp/create` route |
| `src/components/whatsapp/CreateGroupDialog.tsx` | Delete -- replaced by dedicated page |

## No Database Changes Required
