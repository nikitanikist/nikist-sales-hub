

# Fix Logo to Display as a Wide Wordmark Banner

## Problem
The current 64x64px square format doesn't work for your wordmark (text-based) logo. The square crops out the text and only shows the sparkle effects, making it look unprofessional. Wordmark logos need a wide, horizontal format.

## Solution
Create a wide banner-style container that spans the sidebar width with minimal height, and position the video to show the text portion.

## Changes

**File: `src/components/AppLayout.tsx`**

### Expanded Sidebar State (lines 76-85)

Change from:
```tsx
<div className="w-16 h-16 mx-auto rounded-xl overflow-hidden shadow-md">
  <video
    src={logoVideo}
    autoPlay
    loop
    muted
    playsInline
    className="w-full h-full object-cover scale-150"
  />
</div>
```

To:
```tsx
<div className="w-full h-12 rounded-lg overflow-hidden">
  <video
    src={logoVideo}
    autoPlay
    loop
    muted
    playsInline
    className="w-full h-auto object-cover object-bottom scale-[2] translate-y-[25%]"
  />
</div>
```

## Design Rationale

| Property | Value | Reason |
|----------|-------|--------|
| `w-full` | 100% width | Span the full sidebar width (~220px) |
| `h-12` | 48px height | Compact banner height for wordmark |
| `rounded-lg` | 8px corners | Softer corners that don't dominate |
| `scale-[2]` | 200% zoom | Zoom in to focus on the text |
| `object-bottom` | Bottom alignment | Focus on the text area at bottom of video |
| `translate-y-[25%]` | Shift down | Fine-tune to center the text in view |

## Visual Comparison

**Before (Square - Current):**
```
┌────────────────────────┐
│       ┌──────┐         │
│       │ ✨✨ │         │  ← 64x64 square, only shows sparkles
│       └──────┘         │
│ [Organization Switch]  │
└────────────────────────┘
```

**After (Wide Banner):**
```
┌────────────────────────┐
│ ┌────────────────────┐ │
│ │   HIGH TICKET      │ │  ← Full width, 48px tall, text visible
│ └────────────────────┘ │
│ [Organization Switch]  │
└────────────────────────┘
```

## Summary

The wordmark text will now be prominently displayed in a wide banner format that matches professional logo placement in sidebars. The video is scaled and positioned to crop out excess sparkle effects and focus on the readable text.

