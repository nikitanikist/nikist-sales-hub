
# Fix Logo Size in Sidebar

## Problem
The logo video currently uses `aspect-video` (16:9 ratio), making it look like a video player instead of a compact logo. It takes up too much vertical and horizontal space.

## Solution
Make the logo smaller and more compact with a square/near-square aspect ratio, and zoom in slightly to focus on the logo content.

## Changes

**File: `src/components/AppLayout.tsx`**

### Expanded Sidebar State (line 76)
Change from:
```tsx
<div className="w-full aspect-video rounded-xl overflow-hidden shadow-md">
```

To:
```tsx
<div className="w-16 h-16 mx-auto rounded-xl overflow-hidden shadow-md">
```

Also scale the video slightly larger than its container to "zoom in" on the logo:
```tsx
<video
  src={logoVideo}
  autoPlay
  loop
  muted
  playsInline
  className="w-full h-full object-cover scale-150"
/>
```

### Visual Comparison

**Before:**
```
┌────────────────────────┐
│ ┌────────────────────┐ │
│ │                    │ │  ← Full width, 16:9 aspect
│ │    LOGO VIDEO      │ │     (looks like video player)
│ │                    │ │
│ └────────────────────┘ │
│ [Organization Switch]  │
└────────────────────────┘
```

**After:**
```
┌────────────────────────┐
│       ┌──────┐         │
│       │ LOGO │         │  ← 64x64px, centered
│       └──────┘         │     (proper logo size)
│ [Organization Switch]  │
└────────────────────────┘
```

## Summary

| Change | Before | After |
|--------|--------|-------|
| Container width | `w-full` | `w-16` (64px) |
| Aspect ratio | `aspect-video` (16:9) | `h-16` (square) |
| Position | Full width | `mx-auto` (centered) |
| Video scale | Normal | `scale-150` (zoomed in) |
