

# Move Action Buttons into PageIntro Cards

## What We're Fixing
Currently, the action buttons (e.g., "Bulk Import", "Add Data", "Add Closer") are positioned separately below the PageIntro banner, leaving awkward empty space. We'll move these buttons inside the PageIntro card for a cleaner, more cohesive design.

---

## Design Result

| Before | After |
|--------|-------|
| PageIntro card with icon + text | PageIntro card with icon + text + buttons on right |
| Empty gap | No gap - buttons inside the card |
| Buttons floating below | Integrated design |

---

## Technical Changes

### 1. Update PageIntro Component

**File:** `src/components/PageIntro.tsx`

Add an optional `actions` prop to render buttons on the right side of the card:

```tsx
interface PageIntroProps {
  icon: LucideIcon;
  tagline: string;
  description: string;
  variant?: "violet" | "emerald" | "amber" | "sky" | "rose";
  className?: string;
  actions?: React.ReactNode; // NEW - optional slot for buttons
}
```

Update the layout to use `flex justify-between` and render the actions on the right:

```tsx
<div className="flex items-center justify-between gap-4">
  <div className="flex items-center gap-3 sm:gap-4">
    {/* Icon + Text */}
  </div>
  {actions && (
    <div className="flex items-center gap-2 shrink-0">
      {actions}
    </div>
  )}
</div>
```

---

### 2. Update Daily Money Flow Page

**File:** `src/pages/DailyMoneyFlow.tsx`

Move the "Bulk Import" and "Add Data" buttons into the PageIntro component:

```tsx
<PageIntro
  icon={IndianRupee}
  tagline="Track Your Revenue"
  description="Monitor daily cash collections and revenue trends."
  variant="emerald"
  actions={
    <>
      <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
        <Upload className="h-4 w-4 mr-2" />
        Bulk Import
      </Button>
      <Button onClick={() => setIsAddDialogOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        Add Data
      </Button>
    </>
  }
/>
```

Remove the separate `<div className="flex justify-end gap-2">` that currently holds these buttons.

---

### 3. Update Sales Closers Page

**File:** `src/pages/SalesClosers.tsx`

Move the "Add Closer" button (Dialog) into the PageIntro component:

```tsx
<PageIntro
  icon={Users}
  tagline="Your Sales Team"
  description="Monitor performance and manage your closers."
  variant="violet"
  actions={
    isAdmin && (
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Closer
          </Button>
        </DialogTrigger>
        {/* DialogContent stays the same */}
      </Dialog>
    )
  }
/>
```

Remove the separate conditional block that renders the button below PageIntro.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/PageIntro.tsx` | Add `actions` prop and update layout |
| `src/pages/DailyMoneyFlow.tsx` | Move buttons into PageIntro, remove separate button container |
| `src/pages/SalesClosers.tsx` | Move Add Closer dialog into PageIntro, remove separate container |

---

## Mobile Responsiveness

The buttons will stack or adjust on mobile using:
- `flex-wrap` for multiple buttons
- `hidden sm:flex` to hide full button text on very small screens if needed
- Icon-only buttons on mobile (optional enhancement)

---

## Expected Result

- **Daily Money Flow**: Green card with "Track Your Revenue" + "Bulk Import" & "Add Data" buttons on the right
- **Sales Closers**: Violet card with "Your Sales Team" + "Add Closer" button on the right
- No more awkward empty space between intro and content
- Cleaner, more professional look matching modern SaaS UIs

