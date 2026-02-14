

# UI Polish: Campaigns Filter Cards + Campaign Detail Layout

## 1. Campaigns Page -- Elevated Filter Cards

The current filter cards are small and flat. They need more visual presence to feel like a professional dashboard.

**Changes to `src/pages/whatsapp/Campaigns.tsx`:**
- Increase card padding and font sizes (count goes from `text-lg` to `text-2xl`)
- Add a subtle colored background tint to each card (e.g., emerald-50 for Completed, blue-50 for Scheduled)
- Add a gradient left border accent on the active card
- Give the icon a circular tinted background (pill shape) for visual weight
- Add a subtle shadow on hover

## 2. Campaign Detail Page -- Reorganized Layout

Based on the annotated screenshot, the desired layout is:

```text
+-----------------------------+------------------+
|                             |                  |
|   Analytics Cards (3x2)    | Message Preview  |
|                             |  (portrait)      |
+-----------------------------+------------------+
|                                                |
|          Groups Table (full width)             |
|                                                |
+------------------------------------------------+
```

**Changes to `src/pages/whatsapp/CampaignDetail.tsx`:**
- Move to a two-row structure instead of the current two-column structure
- **Top row** is two columns: left = 3-column stats grid, right = WhatsApp preview (portrait, not sticky)
- **Bottom row** is the full-width groups breakdown table
- On mobile, stack: preview on top, stats below it, then table
- Polish the stat cards with colored icon backgrounds and slightly larger text

### Technical Summary

Only two files modified, no database changes, no new components.

