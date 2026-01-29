

# Fix Duplicate Buttons on Daily Money Flow Page

## The Problem
The "Bulk Import" and "Add Data" buttons appear twice:
1. Inside the green PageIntro card (correct - this is the one you want)
2. In a separate container below the card (duplicate - needs to be removed)

---

## Technical Fix

**File:** `src/pages/DailyMoneyFlow.tsx`

**Remove lines 490-500** - the duplicate button container:

```tsx
{/* Action Buttons */}
<div className="flex gap-2 justify-end">
  <Button variant="outline" size="sm" className="sm:size-default h-10" onClick={() => setIsImportDialogOpen(true)}>
    <Upload className="h-4 w-4 sm:mr-2" />
    <span className="hidden sm:inline">Bulk Import</span>
  </Button>
  <Button size="sm" className="sm:size-default h-10" onClick={() => setIsAddDialogOpen(true)}>
    <Plus className="h-4 w-4 sm:mr-2" />
    <span className="hidden sm:inline">Add Data</span>
  </Button>
</div>
```

The buttons inside the PageIntro card (lines 474-487) will remain, giving you the clean integrated design you want.

---

## Result After Fix

- Only ONE set of buttons inside the green PageIntro card
- No more duplicate buttons below
- No wasted space
- Clean, integrated design

---

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/DailyMoneyFlow.tsx` | Remove duplicate button container (lines 490-500) |

