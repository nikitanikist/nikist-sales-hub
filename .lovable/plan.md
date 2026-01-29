
# Fix Manager Access to Cohort Batches Sidebar

## Problem Summary
Managers cannot see the "Cohort Batches" option in the sidebar because of a **permission key mismatch** between the frontend permission system and the sidebar filtering logic.

## Root Cause Analysis
There are two permission systems in conflict:

| Component | Permission Keys Used |
|-----------|---------------------|
| `permissions.ts` | `cohort_batches` (unified) |
| `AppLayout.tsx` cohort children | `batch_icc` (not defined in PERMISSION_KEYS) |
| Edge function `manage-users` | `batch_icc`, `batch_futures`, `batch_high_future` (granular) |

When the sidebar filters menu items:
1. It checks if each child has a valid permission via `hasPermission(child.permissionKey)`
2. For cohort children, it passes `batch_icc` which doesn't exist in `PERMISSION_KEYS`
3. The `hasPermission` function returns `false` for non-admins (only admins bypass the check)
4. All cohort children get filtered out → the entire "Cohort Batches" menu disappears

## Solution
Update `AppLayout.tsx` to use the correct unified permission key `cohort_batches` for all cohort menu children instead of the non-existent `batch_icc`.

Also update `permissions.ts` to include the full set of manager permissions as requested:
- All menu items EXCEPT "Daily Money Flow" and "Users"

---

## Technical Changes

### File 1: `src/lib/permissions.ts`
**Change**: Update `DEFAULT_PERMISSIONS.manager` array

```typescript
// Current (lines 90-96):
manager: [
  PERMISSION_KEYS.daily_money_flow,
  PERMISSION_KEYS.customers,
  PERMISSION_KEYS.sales_closers,
  PERMISSION_KEYS.cohort_batches,
  PERMISSION_KEYS.workshops,
],

// New:
manager: [
  PERMISSION_KEYS.dashboard,
  // daily_money_flow - NOT included
  PERMISSION_KEYS.customers,
  PERMISSION_KEYS.customer_insights,
  PERMISSION_KEYS.call_schedule,
  PERMISSION_KEYS.sales_closers,
  PERMISSION_KEYS.cohort_batches,
  PERMISSION_KEYS.workshops,
  PERMISSION_KEYS.sales,
  PERMISSION_KEYS.funnels,
  PERMISSION_KEYS.products,
  // users - NOT included
],
```

### File 2: `src/components/AppLayout.tsx`
**Change**: Use `cohort_batches` permission key for cohort children

```typescript
// Line 223 - Change 'batch_icc' to 'cohort_batches'
{ title: "+ Create Cohort", path: "/cohorts/manage", permissionKey: 'cohort_batches' as PermissionKey }

// Line 232 - Change 'batch_icc' to 'cohort_batches'  
permissionKey: 'cohort_batches' as PermissionKey

// Line 240 - Change 'batch_icc' to 'cohort_batches'
permissionKey: 'cohort_batches' as PermissionKey
```

---

## Summary of Manager Access After Fix

| Menu Item | Manager Access |
|-----------|---------------|
| Dashboard | ✅ Yes |
| Daily Money Flow | ❌ No |
| Customers | ✅ Yes |
| Customer Insights | ✅ Yes |
| 1:1 Call Schedule | ✅ Yes |
| Sales Closers | ✅ Yes |
| Cohort Batches | ✅ Yes |
| All Workshops | ✅ Yes |
| Sales | ✅ Yes |
| Active Funnels | ✅ Yes |
| Products | ✅ Yes |
| Users | ❌ No |

Financial data (offered amount, cash collected, remaining) will continue to be visible to managers as those checks already include managers.
