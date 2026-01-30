
# Reorganize Sidebar Navigation into Grouped Categories

## Overview
Restructure the sidebar menu from a flat list into organized collapsible categories for better UX. Also rename "Users" to "Team Members" to avoid confusion with customers.

---

## Proposed Sidebar Structure

```
┌─────────────────────────────────┐
│  Dashboard                      │
├─────────────────────────────────┤
│ ▼ Finance                       │
│    ├─ Daily Money Flow          │
│    └─ Sales                     │
├─────────────────────────────────┤
│ ▼ Customers                     │
│    ├─ All Customers             │
│    └─ Customer Insights         │
├─────────────────────────────────┤
│ ▼ Closers                       │
│    ├─ 1:1 Call Schedule         │
│    └─ Sales Closers             │
├─────────────────────────────────┤
│ ▼ Funnels                       │
│    ├─ All Workshops             │
│    ├─ Active Funnels            │
│    └─ Products                  │
├─────────────────────────────────┤
│ ▼ Cohort Batches                │
│    ├─ [Dynamic cohort types]    │
│    └─ Manage Cohorts            │
├─────────────────────────────────┤
│ ▼ Operations                    │
│    └─ Workshop Notification     │
├─────────────────────────────────┤
│  Team Members                   │
├─────────────────────────────────┤
│  Settings                       │
└─────────────────────────────────┘
```

---

## Changes Summary

| Current | New |
|---------|-----|
| Flat list of ~14 items | 5 collapsible groups + 3 standalone items |
| "Users" menu item | Renamed to "Team Members" |
| "Customers" menu item | Renamed to "All Customers" (within Customers group) |

---

## Technical Implementation

### File: `src/components/AppLayout.tsx`

**Changes to `allMenuItems` array:**

```typescript
const allMenuItems: MenuItem[] = useMemo(() => [
  // Standalone: Dashboard
  { 
    title: "Dashboard", 
    icon: LayoutDashboard, 
    path: "/", 
    isBeta: true, 
    permissionKey: 'dashboard' 
  },
  
  // GROUP: Finance
  { 
    title: "Finance", 
    icon: Wallet, 
    children: [
      { title: "Daily Money Flow", path: "/daily-money-flow", permissionKey: 'daily_money_flow' },
      { title: "Sales", path: "/sales", permissionKey: 'sales' },
    ],
    // No single moduleSlug - children have different modules
  },
  
  // GROUP: Customers
  { 
    title: "Customers", 
    icon: Users, 
    children: [
      { title: "All Customers", path: "/leads", permissionKey: 'customers' },
      { title: "Customer Insights", path: "/onboarding", permissionKey: 'customer_insights' },
    ],
  },
  
  // GROUP: Closers
  { 
    title: "Closers", 
    icon: UserCog, 
    moduleSlug: 'one-to-one-funnel',  // Both children require this module
    children: [
      { title: "1:1 Call Schedule", path: "/calls", permissionKey: 'call_schedule' },
      { title: "Sales Closers", path: "/sales-closers", permissionKey: 'sales_closers' },
    ],
  },
  
  // GROUP: Funnels
  { 
    title: "Funnels", 
    icon: TrendingUp, 
    children: [
      { title: "All Workshops", path: "/workshops", permissionKey: 'workshops' },
      { title: "Active Funnels", path: "/funnels", permissionKey: 'funnels' },
      { title: "Products", path: "/products", permissionKey: 'products' },
    ],
  },
  
  // GROUP: Cohort Batches (dynamic, unchanged)
  { 
    title: "Cohort Batches", 
    icon: GraduationCap, 
    children: dynamicCohortChildren,
    moduleSlug: 'cohort-management'
  },
  
  // GROUP: Operations (unchanged)
  { 
    title: "Operations", 
    icon: Activity, 
    children: [
      { title: "Workshop Notification", path: "/operations/workshop-notification", permissionKey: 'workshops' },
    ],
    moduleSlug: 'workshops'
  },
  
  // Standalone: Team Members (renamed from "Users")
  { 
    title: "Team Members", 
    icon: UsersRound, 
    path: "/users", 
    permissionKey: 'users' 
  },
  
  // Standalone: Settings
  { 
    title: "Settings", 
    icon: Settings, 
    path: "/settings", 
    permissionKey: 'settings' 
  },
], [dynamicCohortChildren]);
```

### Additional Considerations

**Module Filtering Logic:**
- The Finance group has children with different module requirements:
  - "Daily Money Flow" requires `daily-money-flow` module
  - "Sales" has no module requirement
- Need to add `moduleSlug` to child items for proper filtering

**Update MenuItem interface:**
```typescript
interface MenuItem {
  title: string;
  icon: typeof LayoutDashboard;
  path?: string;
  isBeta?: boolean;
  permissionKey?: PermissionKey;
  moduleSlug?: string;
  children?: {
    title: string;
    path: string;
    permissionKey?: PermissionKey;
    moduleSlug?: string;  // ADD: Module for individual children
  }[];
}
```

**Update `filterMenuItems` function:**
- Check moduleSlug on children as well as parent
- Filter children by both permission AND module

---

### File: `src/pages/Users.tsx`

**Update PageIntro:**
```typescript
<PageIntro
  icon={UsersIcon}
  tagline="Team Members"  // Keep consistent with sidebar
  description="Manage access and roles for your organization."
  variant="violet"
/>
```

---

### File: `src/lib/permissions.ts`

**Update permission labels:**
```typescript
export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  // ... existing
  users: 'Team Members',  // Changed from 'Users'
};
```

**Update permission groups for organized display:**
```typescript
export const PERMISSION_GROUPS = [
  {
    label: 'Finance',
    permissions: [
      PERMISSION_KEYS.daily_money_flow,
      PERMISSION_KEYS.sales,
    ],
  },
  {
    label: 'Customers',
    permissions: [
      PERMISSION_KEYS.customers,
      PERMISSION_KEYS.customer_insights,
    ],
  },
  {
    label: 'Closers',
    permissions: [
      PERMISSION_KEYS.call_schedule,
      PERMISSION_KEYS.sales_closers,
    ],
  },
  {
    label: 'Funnels',
    permissions: [
      PERMISSION_KEYS.workshops,
      PERMISSION_KEYS.funnels,
      PERMISSION_KEYS.products,
    ],
  },
  {
    label: 'Cohort Batches',
    permissions: [
      PERMISSION_KEYS.cohort_batches,
    ],
  },
  {
    label: 'Other',
    permissions: [
      PERMISSION_KEYS.dashboard,
      PERMISSION_KEYS.users,
      PERMISSION_KEYS.settings,
    ],
  },
];
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/AppLayout.tsx` | Restructure `allMenuItems` into grouped categories, update child filtering logic |
| `src/lib/permissions.ts` | Update permission labels and groups |
| `src/pages/Users.tsx` | Already shows "Team Members" - no change needed |

---

## Visual Before/After

**Before (14 items, mostly flat):**
```
Dashboard
Daily Money Flow
Customers
Customer Insights
1:1 Call Schedule
Sales Closers
▼ Cohort Batches
All Workshops
▼ Operations
Sales
Active Funnels
Products
Users
Settings
```

**After (organized groups):**
```
Dashboard
▼ Finance
▼ Customers  
▼ Closers
▼ Funnels
▼ Cohort Batches
▼ Operations
Team Members
Settings
```

Much cleaner with logical groupings that match business functions!
