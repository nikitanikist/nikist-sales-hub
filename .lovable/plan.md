

# Show Current Page Name in Header

## What We're Doing
Replace the organization name in the header with the current page/section name. The header will dynamically show:
- "Dashboard" when on `/`
- "Daily Money Flow" when on `/daily-money-flow`
- "Customers" when on `/leads`
- "1:1 Call Schedule" when on `/calls`
- And so on for all pages...

---

## Technical Changes

**File:** `src/components/AppLayout.tsx`

### Change 1: Create a function to get the current page title

Add a helper function that finds the page title by matching the current pathname against the menu items (including nested children for cohort types).

```tsx
// Add this after the filterMenuItems function (around line 328)
const getCurrentPageTitle = (): string => {
  const currentPath = location.pathname;
  
  // Check top-level menu items
  for (const item of menuItems) {
    if (item.path === currentPath) {
      return item.title;
    }
    // Check children (for Cohort Batches submenu)
    if (item.children) {
      for (const child of item.children) {
        if (child.path === currentPath) {
          return child.title;
        }
      }
    }
  }
  
  // Fallback to organization name or CRM
  return currentOrganization?.name || "CRM";
};
```

### Change 2: Update the header to use the page title

Update line 378 to use the new function instead of the organization name.

```tsx
// FROM:
<h1 className="text-lg sm:text-xl font-semibold hidden sm:block">
  {currentOrganization?.name || "CRM"}
</h1>

// TO:
<h1 className="text-lg sm:text-xl font-semibold hidden sm:block">
  {getCurrentPageTitle()}
</h1>
```

---

## How It Works

| Current Path | Header Shows |
|--------------|--------------|
| `/` | Dashboard |
| `/daily-money-flow` | Daily Money Flow |
| `/leads` | Customers |
| `/onboarding` | Customer Insights |
| `/calls` | 1:1 Call Schedule |
| `/sales-closers` | Sales Closers |
| `/cohorts/futures` | Futures (or whatever cohort name) |
| `/workshops` | All Workshops |
| `/sales` | Sales |
| `/funnels` | Active Funnels |
| `/products` | Products |
| `/users` | Users |
| `/settings` | Settings |
| `/super-admin` | Super Admin Dashboard |

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/AppLayout.tsx` | Add `getCurrentPageTitle()` function and update header text |

---

## Expected Result

- Header dynamically shows the current page name
- Automatically matches sidebar menu items
- Works for all pages including dynamic cohort types
- Falls back to organization name if no match found

