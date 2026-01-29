

# Remove Duplicate Page Titles from Content Area

## What We're Fixing
The page title now appears twice:
1. **Header** (sticky bar): Shows "Sales Closers", "Daily Money Flow", etc.
2. **Content area**: Same title appears again as an `<h1>` in each page

We'll remove the duplicate titles from the content area, keeping only the header version.

---

## Pages to Update

| Page | File | What to Remove |
|------|------|----------------|
| Dashboard | `src/pages/Dashboard.tsx` | Remove the "Welcome back" header section (greeting + h1 + subtitle) |
| Daily Money Flow | `src/pages/DailyMoneyFlow.tsx` | Remove header div with title + subtitle |
| Sales Closers | `src/pages/SalesClosers.tsx` | Remove header div with title + subtitle |
| Users | `src/pages/Users.tsx` | Remove header div with title + subtitle |
| Sales | `src/pages/Sales.tsx` | Remove header div with title + subtitle |
| Products | `src/pages/Products.tsx` | Remove header div with icon + title |
| Manage Cohorts | `src/pages/ManageCohorts.tsx` | Remove header div with title + subtitle |
| 1:1 Call Schedule | `src/pages/Calls.tsx` | Remove h1 title |
| Organization Settings | `src/pages/OrganizationSettings.tsx` | Remove header div with icon + title |
| Super Admin Dashboard | `src/pages/SuperAdminDashboard.tsx` | Remove header div with icon + title + subtitle |
| Cohort Page | `src/pages/CohortPage.tsx` | Remove header div with title + subtitle (lines 692-696) |
| Futures Mentorship | `src/pages/FuturesMentorship.tsx` | Remove header div with icon + title |
| High Future | `src/pages/HighFuture.tsx` | Remove header div with icon + title (if exists) |
| All Closer Calls | `src/pages/AllCloserCalls.tsx` | Remove header div with title + subtitle |
| Closer Assigned Calls | `src/pages/CloserAssignedCalls.tsx` | Remove header div with title + subtitle |
| Batches | `src/pages/Batches.tsx` | Remove header div with title + subtitle (line 2424-2427) |
| Funnels | `src/pages/Funnels.tsx` | Keep as-is (title is inside a Card, not a page header) |
| Workshops | `src/pages/Workshops.tsx` | Check and remove if exists |
| Onboarding | `src/pages/Onboarding.tsx` | Keep as-is (special user-facing onboarding flow) |
| Leads | `src/pages/Leads.tsx` | Check and remove if exists |

---

## Technical Changes Pattern

For each page, we'll remove the header section that contains the `<h1>` title. Most follow this pattern:

```tsx
// REMOVE THIS PATTERN:
<div className="flex flex-col sm:flex-row ...">
  <div>
    <h1 className="text-... font-bold ...">Page Title</h1>
    <p className="text-... text-muted-foreground">Subtitle here</p>
  </div>
  {/* Action buttons remain - these will be repositioned */}
</div>
```

---

## Special Cases

1. **Dashboard**: Has greeting + welcome text - remove entire greeting block but keep AutomationStatusWidget
2. **Pages with action buttons**: Move buttons to a simpler row layout after removing title
3. **Funnels**: Title is inside CardHeader, not a page header - leave as-is
4. **Onboarding**: This is a customer-facing form, not part of the CRM navigation - leave as-is

---

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Remove greeting header section |
| `src/pages/DailyMoneyFlow.tsx` | Remove page header div |
| `src/pages/SalesClosers.tsx` | Remove page header div, keep Add Closer button |
| `src/pages/Users.tsx` | Remove page header div |
| `src/pages/Sales.tsx` | Remove page header div |
| `src/pages/Products.tsx` | Remove page header div |
| `src/pages/ManageCohorts.tsx` | Remove page header div |
| `src/pages/Calls.tsx` | Remove h1 element |
| `src/pages/OrganizationSettings.tsx` | Remove page header div |
| `src/pages/SuperAdminDashboard.tsx` | Remove page header div |
| `src/pages/CohortPage.tsx` | Remove page header div (list view) |
| `src/pages/FuturesMentorship.tsx` | Remove page header div |
| `src/pages/AllCloserCalls.tsx` | Remove page header div |
| `src/pages/CloserAssignedCalls.tsx` | Remove page header div |
| `src/pages/Batches.tsx` | Remove page header div |
| `src/pages/Workshops.tsx` | Check and remove if needed |
| `src/pages/Leads.tsx` | Check and remove if needed |

---

## Expected Result

- Each page will have the title displayed only once - in the sticky header
- Action buttons (Add, Import, etc.) will remain functional
- Cleaner UI with no duplicate information
- More vertical space for actual content

