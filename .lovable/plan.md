
# Fix Sticky Header - Correct the Scroll Container

## What You Want
The header bar (hamburger menu ≡ + "Nikist" + avatar "N") should stay fixed at the top while only the dashboard content scrolls underneath.

## Why It Is Not Working

The page has **two scroll sources**:
1. The browser window itself (body/html)
2. The `<main>` element with `overflow-auto`

Currently, the **browser window is scrolling** instead of just `<main>`. The `sticky` positioning only works relative to the nearest scroll container, but if the entire page scrolls, the header goes with it.

**Current Problem Structure:**
```
body (scrolling!)
  └── wrapper div (min-h-screen - can grow beyond viewport)
        └── main (overflow-auto - should be the only scroll)
              └── header (sticky - but page is scrolling, not main!)
              └── content
```

## Solution

Lock the outer wrapper to the viewport height so only `<main>` can scroll.

**Fixed Structure:**
```
body (no scroll)
  └── wrapper div (h-screen, overflow-hidden - locked to viewport)
        └── main (overflow-auto - THE ONLY scroll container)
              └── header (sticky - now works!)
              └── content
```

---

## Technical Changes

**File:** `src/components/AppLayout.tsx`

### Change 1: Lock wrapper div to viewport (Line 362)

```tsx
// FROM:
<div className="flex min-h-screen w-full">

// TO:
<div className="flex h-screen w-full overflow-hidden">
```

**What this does:**
- `h-screen` (instead of `min-h-screen`): Fixed height, cannot grow
- `overflow-hidden`: Prevents this div from scrolling

### Why This Works

| Before | After |
|--------|-------|
| Wrapper can grow beyond viewport | Wrapper locked to viewport height |
| Browser window scrolls | Browser window cannot scroll |
| Sticky has no effect | Sticky works because only `main` scrolls |

---

## Files to Modify

| File | Line | Change |
|------|------|--------|
| `src/components/AppLayout.tsx` | 362 | Change `min-h-screen` to `h-screen overflow-hidden` |

---

## Expected Result

After this single line change:
- The header (hamburger + "Nikist" + "N" avatar) stays fixed at the top
- Dashboard content scrolls underneath the header
- Backdrop blur effect shows content scrolling behind the semi-transparent header
- Works on all pages (Dashboard, Leads, etc.) and on all devices
