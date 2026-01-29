

# Fix Sticky Header - Correct CSS Structure

## Problem Root Cause

CSS `position: sticky` only works when the element is **inside** a scrolling container. Currently:

```
main (overflow-hidden)       <-- NOT scrolling
  └── header (sticky)        <-- Sticky has NO effect!
  └── content (overflow-auto) <-- Scrolling is here (sibling, not parent)
```

The header needs to be **inside** the scrolling container for sticky to work.

---

## Solution

Move scrolling to `<main>` so the header is inside the scrolling area.

---

## Technical Changes

**File:** `src/components/AppLayout.tsx`

### Change 1: Update main container (Line 372)

```tsx
// FROM:
<main className="flex-1 flex flex-col overflow-hidden">

// TO:
<main className="flex-1 overflow-auto">
```

### Change 2: Update header (Line 373)

```tsx
// FROM:
<div className="sticky top-0 shrink-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border shadow-sm">

// TO:
<div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border shadow-sm">
```

### Change 3: Remove wrapper div around content (Lines 418-422)

```tsx
// FROM:
<div className="flex-1 overflow-auto">
  <div className="p-4 sm:p-6">
    <Outlet />
  </div>
</div>

// TO:
<div className="p-4 sm:p-6">
  <Outlet />
</div>
```

---

## New Structure (Correct)

```
main (overflow-auto)         <-- Scrolling container
  └── header (sticky top-0)  <-- Sticks to top while main scrolls!
  └── content                <-- Scrolls with main
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/AppLayout.tsx` | Restructure main to be the scroll container, remove wrapper div |

---

## Expected Result

- Header stays fixed at top when scrolling any page
- Backdrop blur effect works correctly as content scrolls behind
- Works on all pages and devices

