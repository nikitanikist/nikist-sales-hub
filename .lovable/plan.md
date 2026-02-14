

# WhatsApp Module UI/UX Improvements -- Round 2

## 1. Campaigns Page -- Replace Summary Cards with Clickable Filter Cards

**Current state:** The page has both summary stat cards at the top AND a separate tab strip below them. Both serve the same filtering purpose.

**Change:** Remove the separate `Tabs`/`TabsList` component. Make the top summary cards themselves clickable to act as the filter. Clicking a card highlights it (active border/ring) and filters the table. Add an "All" card at the beginning.

This matches the reference screenshot showing a clean pill/card row: `All (16) | Completed | Scheduled | Sending | Failed`.

**File:** `src/pages/whatsapp/Campaigns.tsx`

## 2. Remove "Scheduled" Sub-menu from Sidebar

Since scheduled campaigns are now visible within the Campaigns page (via the "Scheduled" filter card), the separate "Scheduled" sidebar link is redundant.

**File:** `src/components/AppLayout.tsx` -- Remove line 354 (`{ title: "Scheduled", path: "/whatsapp/scheduled" }`)

## 3. Campaign Detail Page -- Two-Column Layout with Compact Stats

**Current state:** Stats are spread across 7 individual cards in a single row (overflows on smaller screens). The message preview is a full-width card below, taking up excessive vertical space.

**Change:**
- Switch to a **two-column layout** on desktop:
  - **Left column (2/3 width):** Analytics stats in a compact 3x2 grid (Audience, Sent, Failed, Pending, Delivered, Read, Reactions) using small inline cards, followed by the groups breakdown table below
  - **Right column (1/3 width):** WhatsApp message preview in portrait orientation, sticky so it stays visible while scrolling the table
- On mobile, stack: preview first, then stats, then table

**File:** `src/pages/whatsapp/CampaignDetail.tsx`

---

## Technical Summary

### Files to Modify
1. **`src/pages/whatsapp/Campaigns.tsx`** -- Remove Tabs, make stat cards clickable filters, add "All" card
2. **`src/components/AppLayout.tsx`** -- Remove "Scheduled" sidebar entry (line 354)
3. **`src/pages/whatsapp/CampaignDetail.tsx`** -- Two-column layout: stats grid + table on left, portrait WhatsApp preview on right

### No New Files or Database Changes
All changes are purely frontend layout/UX improvements.

