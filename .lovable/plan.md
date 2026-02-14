

# WhatsApp Module UI/UX Overhaul

This plan covers a complete redesign of the WhatsApp section across 5 areas: Dashboard, Send Notification wizard, Campaigns page, Templates page, and Campaign Detail page.

---

## 1. Dashboard Improvements

**Current issues:**
- Dropdown says "All Sessions" instead of "All Numbers"
- Shows ALL groups including non-admin groups (457 total, but many are useless)
- Stats count non-admin groups too

**Changes:**
- Rename "All Sessions" to "All Numbers" in the session selector
- Filter the groups table to only show `is_admin: true` groups by default
- Update "Total Groups" and "Total Members" stats to reflect admin-only groups
- Add gradient accent to stat cards for visual polish (matching the Vibrant design system)
- Add icons to stat cards (MessageSquare for groups, Users for members, Phone for numbers)

---

## 2. Send Notification Wizard -- Complete Redesign

This is the biggest change. The current wizard is left-aligned in a narrow `max-w-3xl` container with plain numbered circles.

### Step Indicator
- Replace plain number circles with a labeled stepper: "Select Groups" > "Draft Message" > "Configure" > "Confirm"
- Each step shows its name below the circle
- Completed steps get a checkmark with a green/purple fill
- Active step has a glow/ring effect
- Center the entire wizard content on the page

### Step 1 -- Select Groups
- Minor polish only; current layout is functional

### Step 2 -- Draft Message (Major Redesign)
- Change from single-column to a **two-column layout** (like the existing TemplateEditor):
  - **Left column**: Compose area with template selector, message textarea, and media upload
  - **Right column**: Live WhatsApp preview using the existing `WhatsAppPreview` component
- Add a **"Clear template"** (X) button next to the template selector so users can deselect a loaded template
- Replace the "Media URL" text input with the existing `TemplateMediaUpload` component (drag-and-drop file upload with storage upload to the `template-media` bucket)
- Reuse the `WhatsAppPreview` component from `src/components/settings/WhatsAppPreview.tsx` for real-time message preview

### Step 3 -- Configuration
- Minor styling improvements (consistent spacing, card layout)

### Step 4 -- Confirm and Send (Redesign)
- Change to a two-column layout:
  - **Left column**: Campaign summary details (name, groups, audience, delay, schedule) in a clean card
  - **Right column**: Full WhatsApp message preview using `WhatsAppPreview` component with media
- Better typography and spacing for the summary fields

---

## 3. Campaigns Page -- Redesign

**Current issues:**
- No way to delete campaigns
- No scheduled date column for scheduled campaigns
- No status filtering or summary cards
- Plain table with no visual hierarchy

**Changes:**
- Add **summary cards** at the top: Completed (count), Scheduled (count), Sending (count), Failed (count) -- each with an icon and colored accent
- Add **tabs**: "All", "Completed", "Scheduled", "Sending", "Failed" for quick filtering
- Add a **"Scheduled For"** column that shows the scheduled date (only for scheduled campaigns, otherwise shows "--")
- Add a **delete button** (trash icon) on each row with a confirmation dialog
- Add a delete mutation using the existing `ConfirmDeleteDialog` component
- Improve status badges with better color coding

---

## 4. Templates Page -- Redesign

**Current issues:**
- The "New Template" dialog is a basic modal with a URL input for media
- The settings page already has a beautiful full-page `TemplateEditor` with upload + preview

**Changes:**
- Remove the inline dialog for create/edit
- When clicking "New Template" or the edit button, navigate to a new route `/whatsapp/templates/new` or `/whatsapp/templates/:id/edit`
- Reuse the existing `TemplateEditor` component (from `src/pages/settings/TemplateEditor.tsx`) but modify the back navigation to go to `/whatsapp/templates` instead of `/settings?tab=templates`
- This gives users the full compose + preview experience with file upload, variable insertion, and WhatsApp preview

---

## 5. Campaign Detail Page -- Minor Polish

- Replace the plain text "Message" card with the `WhatsAppPreview` component for a visual message preview
- Keep the groups breakdown table as-is (it works well)

---

## Technical Details

### Files to Create
- None (reusing existing components)

### Files to Modify
1. **`src/pages/whatsapp/WhatsAppDashboard.tsx`** -- Admin-only filter, rename "All Sessions" to "All Numbers", stat card polish
2. **`src/pages/whatsapp/SendNotification.tsx`** -- Major rewrite: centered layout, labeled stepper, two-column draft step with WhatsAppPreview and TemplateMediaUpload, two-column confirm step with preview
3. **`src/pages/whatsapp/Campaigns.tsx`** -- Summary cards, tabs, scheduled date column, delete functionality
4. **`src/pages/whatsapp/Templates.tsx`** -- Navigate to TemplateEditor instead of using inline dialog
5. **`src/pages/whatsapp/CampaignDetail.tsx`** -- Replace message text card with WhatsAppPreview
6. **`src/App.tsx`** -- Add route for `/whatsapp/templates/new` and `/whatsapp/templates/:id/edit` pointing to TemplateEditor
7. **`src/pages/settings/TemplateEditor.tsx`** -- Accept an optional prop or use route context to determine back-navigation path (settings vs whatsapp/templates)

### Existing Components Reused
- `WhatsAppPreview` -- for live message preview in Send Notification wizard and Campaign Detail
- `TemplateMediaUpload` -- for drag-and-drop media upload in Send Notification wizard (replaces URL input)
- `ConfirmDeleteDialog` -- for campaign deletion confirmation
- `MessageToolbar` -- optionally for the draft message step

### Storage
- Media uploads in Send Notification will use the existing `template-media` storage bucket (same as TemplateEditor)

### No Database Changes Required
- All data columns already exist (scheduled_for, media_url, media_type, etc.)
- Campaign deletion is a simple DELETE from notification_campaigns (cascade will handle campaign_groups)

