

# Replace Logo Image with Animated Text Logo

## Overview
Remove the current PNG logo image and replace it with a stylish text-based logo reading "tagfunnel.ai" that features modern typography and a subtle animation effect.

## What Will Change

### Visual Design
- **Text**: "tagfunnel.ai" displayed as styled text
- **Typography**: Bold, modern font with the "tag" part in one style and "funnel.ai" potentially with a gradient or accent
- **Animation**: Subtle shimmer/glow effect that runs on page load and optionally on hover
- **Spacing**: Consistent 20px padding above and below, centered horizontally

### Design Concept
```
┌─────────────────────────┐
│                         │  <- ~20px padding
│     tagfunnel.ai        │  <- Gradient text with shimmer animation
│                         │  <- ~20px padding
├─────────────────────────┤
│ Organization Switcher   │
├─────────────────────────┤
│ Dashboard               │
└─────────────────────────┘
```

## Implementation Steps

1. **Remove the logo image import** from AppLayout.tsx

2. **Create a new TextLogo component** with:
   - "tag" in white/light color
   - "funnel" with a gradient effect (violet to purple, matching brand)
   - ".ai" in a lighter accent color
   - Animated shimmer effect on load
   - Optional subtle hover glow

3. **Update the sidebar header** to use the new text component instead of the `<img>` tag

4. **Add a custom animation** to the CSS for the shimmer/glow effect

5. **Handle collapsed sidebar state** - show just a "T" or funnel icon when sidebar is collapsed

---

## Technical Details

### New CSS Animation (in index.css)
A shimmer animation that creates a subtle light sweep across the text:
- Gradient overlay that moves from left to right
- Runs once on mount with a slight delay
- Optional: repeats on hover

### TextLogo Component Structure
```text
<div className="logo-container">
  <span className="tag-part">tag</span>
  <span className="funnel-part gradient-text">funnel</span>
  <span className="ai-part">.ai</span>
</div>
```

### Styling Approach
- Use the existing `gradient-text` utility class for the gradient effect
- Font: Inter (already imported), weight 700-800 for boldness
- Size: Approximately 20-24px to fill the space appropriately
- Colors: White for "tag", gradient violet-purple for "funnel", muted for ".ai"

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/AppLayout.tsx` | Remove image import, add TextLogo component inline or as separate component |
| `src/index.css` | Add new `@keyframes logo-shimmer` animation |
| `tailwind.config.ts` | Add the shimmer animation to the config |

### Animation Options

**Option A: Shimmer Effect**
A light sweep that moves across the text once on load, creating a premium feel.

**Option B: Subtle Glow Pulse**
The gradient portion gently pulses with a soft glow effect.

**Option C: Letter-by-letter fade in**
Each letter fades in sequentially for a dynamic entrance.

The plan will implement Option A (shimmer) as it's the most polished and professional-looking while being subtle enough not to distract.

