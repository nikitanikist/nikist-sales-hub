

# Improve WhatsApp Groups UX in Webinar Detail Sheet

## Overview

Simplify the WhatsApp Settings section so that linked groups are shown upfront as compact cards, and the full group picker (search, Select All, group list) is hidden behind an expandable dropdown that only appears when needed.

## Current Behavior

When the WhatsApp Settings section is expanded, the full `MultiGroupSelect` component is always visible -- showing Select All, search bar, and all 336 groups in a scrollable list. This is overwhelming when the group is already linked.

## New Behavior

1. **Selected groups shown as compact cards** -- Each linked group displays its name, member count, and a remove button. This is always visible.
2. **Full group picker hidden by default** -- A "Add / Change Groups" button toggles the full MultiGroupSelect component. It collapses back after selection.
3. **No changes to `MultiGroupSelect` itself** -- The component stays as-is (it is shared with workshops). Only the WebinarDetailSheet wrapper changes.

## Visual Layout (After)

```text
WhatsApp Settings
+-----------------------------------------+
| Account: [Selected Account Dropdown]    |
+-----------------------------------------+
| Linked Groups (1)                       |
| +-------------------------------------+ |
| | Community Name          105 members | |
| +-------------------------------------+ |
|                                         |
| [+ Add / Change Groups]  <- button     |
|                                         |
| (clicking reveals MultiGroupSelect)    |
+-----------------------------------------+
```

## Technical Details

### File: `src/pages/webinar/WebinarDetailSheet.tsx`

Changes in the WhatsApp Settings collapsible section (lines ~230-330):

1. Add a `showGroupPicker` boolean state (default `false`)
2. Replace the current direct rendering of `<MultiGroupSelect>` with:
   - A "Linked Groups" subsection showing selected groups as styled cards with group name, participant count, and an X button to unlink
   - A toggle button "Add / Change Groups" that sets `showGroupPicker = true`
   - When `showGroupPicker` is true, render the existing `<MultiGroupSelect>` below
3. Keep the "Create WhatsApp Group" / "Create Additional Group" buttons as-is
4. The existing linked-groups summary block (lines 293-314) will be replaced by the new compact card layout

No database or edge function changes required.

