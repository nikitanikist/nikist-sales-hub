

# Fix Sticky Header - Make It Truly Fixed

## Problem Analysis

The current layout structure has a fundamental issue with how CSS `sticky` positioning works:

**Current Structure:**
```
<main className="flex-1 overflow-auto">  ← This is the scroll container
  <div className="sticky top-0...">       ← Sticky relative to main, but main itself scrolls!
    Header
  </div>
  <div>
    Content (Outlet)
  </div>
</main>
```

When the parent (`<main>`) has `overflow-auto`, it becomes the scrolling container. The sticky header is sticky *within* that container, but since the entire `<main>` content is what scrolls, the header scrolls away too.

---

## Solution

Restructure the layout so:
1. The header is outside the scrollable area
2. Only the content (Outlet) area scrolls

**New Structure:**
```
<main className="flex-1 flex flex-col overflow-hidden">
  <div className="shrink-0 z-10...">       ← Fixed header (doesn't scroll)
    Header
  </div>
  <div className="flex-1 overflow-auto">   ← Only this area scrolls
    Content (Outlet)
  </div>
</main>
```

---

## Technical Changes

**File:** `src/components/AppLayout.tsx`

### Change 1: Update `<main>` container (Line 372)

```tsx
// From:
<main className="flex-1 overflow-auto">

// To:
<main className="flex-1 flex flex-col overflow-hidden">
```

### Change 2: Update header container (Line 373)

```tsx
// From:
<div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border shadow-sm">

// To:
<div className="shrink-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border shadow-sm">
```

### Change 3: Wrap content in scrollable container (Line 418)

```tsx
// From:
<div className="p-4 sm:p-6">
  <Outlet />
</div>

// To:
<div className="flex-1 overflow-auto">
  <div className="p-4 sm:p-6">
    <Outlet />
  </div>
</div>
```

---

## How It Works

| Element | Behavior |
|---------|----------|
| `<main>` with `flex flex-col overflow-hidden` | Creates a flex column that fills available space but clips overflow |
| Header with `shrink-0` | Prevents the header from shrinking, keeps it at natural height |
| Content wrapper with `flex-1 overflow-auto` | Takes remaining space and handles scrolling |

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/AppLayout.tsx` | Restructure layout to separate fixed header from scrollable content |

---

## Expected Result

After this change:
1. The header with organization name and profile avatar will ALWAYS stay visible at the top
2. Only the page content (dashboard, tables, etc.) will scroll
3. The backdrop blur effect will work correctly when content scrolls behind the header
4. Works consistently across all pages and on all devices (desktop + mobile)

