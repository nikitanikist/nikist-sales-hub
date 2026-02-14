

# Campaign Detail -- Stat Cards Redesign (Option B: Colored Border Accent)

## What Changes

Redesign the analytics stat cards in `src/pages/whatsapp/CampaignDetail.tsx`:

- Change grid from **3 columns to 2 columns** (`grid-cols-2` on all breakpoints)
- Increase card size with more padding (`p-5` instead of `p-4`)
- Add a **thick colored left border** (4px) matching each stat's color (e.g., violet for Sent, red for Failed, emerald for Delivered)
- Enlarge icon circles from 40px to 48px (`h-12 w-12`) with icon size bumped to `h-6 w-6`
- Increase the number font from `text-2xl` to `text-3xl`
- Add a subtle gradient background tint to each card (e.g., `bg-gradient-to-r from-violet-500/5 to-transparent`)
- Since 7 stats in a 2-column grid leaves one orphan, the last card (Reactions) will naturally sit alone on the bottom row -- this is fine and adds visual breathing room

## Technical Details

### File Modified
- `src/pages/whatsapp/CampaignDetail.tsx`

### Changes
1. Update `statItems` array to include a `borderColor` property (e.g., `border-l-primary`, `border-l-violet-500`, `border-l-destructive`)
2. Change grid from `grid-cols-2 sm:grid-cols-3 lg:grid-cols-3` to `grid-cols-1 sm:grid-cols-2`
3. Update Card styling: add `border-l-4`, the stat-specific border color, gradient background, and increased padding
4. Enlarge icon container and number text

No database changes. Single file edit.

