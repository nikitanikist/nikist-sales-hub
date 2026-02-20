

# Super Admin Dashboard Redesign - Multi-Page Layout with Enhanced Controls

## What's Changing

The current Super Admin Dashboard is a single page with everything crammed together. We're splitting it into a proper multi-section layout with its own sidebar navigation, adding subscription plan editing, and introducing granular feature/permission controls per organization.

---

## 1. Super Admin Sidebar Navigation

Currently the sidebar only shows one item: "Super Admin Dashboard". We'll expand it to show multiple sections:

| Sidebar Item | Route | Purpose |
|---|---|---|
| Overview | `/super-admin` | Analytics dashboard (MRR, charts, renewals) |
| Organizations | `/super-admin/organizations` | Org list + detail panel (current main content) |
| Subscription Plans | `/super-admin/plans` | Edit/manage all 4 plans (pricing, limits, features) |
| Notifications | `/super-admin/notifications` | View all billing notifications |

**How:** Update `superAdminMenuItems` in `AppLayout.tsx` from 1 item to 4 items with sub-routes.

---

## 2. Split SuperAdminDashboard into Separate Pages

### `/super-admin` - Overview Page (cleaned up)
- Remove the "System Overview / Monitor all organizations..." header
- Keep: MRR stats cards, Plan Distribution chart, Revenue Trend chart, Export buttons, Upcoming Renewals table
- Add: "Create Organization" button stays here
- Clean, focused analytics view

### `/super-admin/organizations` - Organizations Page (NEW)
- Left panel: Organization list (with plan badges, status dots, trial countdown)
- Right panel: Organization detail tabs (Details, Members, Features, Subscription, Usage)
- This is essentially the bottom half of the current page, moved to its own route

### `/super-admin/plans` - Subscription Plans Page (NEW)
- List all 4 plans (Starter, Growth, Pro, Enterprise) as editable cards
- For each plan, ability to:
  - Edit name, description, monthly price, yearly price
  - Edit all plan limits (WhatsApp numbers, team members, groups, campaigns, recipients, dynamic links)
  - Edit plan features (analytics level, community creation, data export, support channel, etc.)
  - Toggle plan active/inactive
- "Add New Plan" button for creating custom plans

### `/super-admin/notifications` - Notifications Page (NEW)
- Full-page view of all subscription notifications (currently just a bell icon)
- Filter by type (trial expiring, expired, limit approaching)
- Mark as read/dismiss

---

## 3. Granular Feature Control per Organization

Currently the "Features" tab only controls 4 high-level modules (One-to-One Sales Funnel, Cohort Management, Workshops, Daily Money Flow). The user wants to control individual sidebar sections and settings integrations.

### Expand the Features Tab with Two Sections:

**Section A: Core Modules** (existing - keep as is)
- One-to-One Sales Funnel
- Cohort Management
- Workshops
- Daily Money Flow

**Section B: Sidebar Permissions** (NEW)
Grouped toggles matching the sidebar structure from `permissions.ts`:
- Finance (Daily Money Flow, Sales)
- Customers (All Customers, Customer Insights)
- Closers (1:1 Call Schedule, Sales Closers)
- Funnels (All Workshops, Active Funnels, Products)
- Cohort Batches
- Operations (Workshop Notification, Dynamic Links, Dead Letter Queue)
- WhatsApp (Dashboard, Campaigns, Templates)
- Team Members
- Settings

This uses the existing `PERMISSION_GROUPS` from `src/lib/permissions.ts`. The super admin will be able to set *default permissions* for the organization -- essentially pre-configuring what the org admin can see and manage.

**Implementation:** Add a new table `organization_feature_overrides` that stores per-org feature visibility. The sidebar filtering logic in `AppLayout.tsx` will check these overrides in addition to user permissions and module enablement.

**Section C: Integration Access** (NEW)
Toggle which integrations an org can configure in their Settings:
- Calendly Integration
- WhatsApp (AISensy) Connection
- Pabbly Webhook
- Workshop Notifications

**Implementation:** Add an `organization_settings` key like `disabled_integrations` (JSONB array) that the Settings page checks before showing integration tabs.

---

## Technical Details

### New Routes in `App.tsx`
```text
/super-admin              -> SuperAdminOverview (analytics only)
/super-admin/organizations -> SuperAdminOrganizations (org management)
/super-admin/plans        -> SuperAdminPlans (plan editing)
/super-admin/notifications -> SuperAdminNotifications (full notification list)
```

### New Files to Create (5 files)
| File | Purpose |
|---|---|
| `src/pages/super-admin/SuperAdminOverview.tsx` | Analytics dashboard page |
| `src/pages/super-admin/SuperAdminOrganizations.tsx` | Org list + detail management |
| `src/pages/super-admin/SuperAdminPlans.tsx` | Plan editor (prices, limits, features) |
| `src/pages/super-admin/SuperAdminNotifications.tsx` | Full notification page |
| `src/pages/super-admin/index.ts` | Barrel exports |

### Files to Modify
| File | Changes |
|---|---|
| `src/components/AppLayout.tsx` | Expand `superAdminMenuItems` to 4 items with icons (LayoutDashboard, Building2, CreditCard, Bell) |
| `src/pages/SuperAdminDashboard.tsx` | Refactor -- split into the 4 new pages above, keep as redirect or overview |
| `src/App.tsx` | Add new routes for `/super-admin/organizations`, `/super-admin/plans`, `/super-admin/notifications` |
| `src/components/super-admin/SubscriptionNotifications.tsx` | Reuse for both bell icon and full page |

### Database Changes
One new table for granular feature overrides:

```text
organization_feature_overrides
  - id UUID PK
  - organization_id UUID FK -> organizations(id) UNIQUE
  - disabled_permissions TEXT[] (array of permission keys to hide)
  - disabled_integrations TEXT[] (array of integration slugs to hide)
  - created_at TIMESTAMPTZ
  - updated_at TIMESTAMPTZ
```

RLS: Super admins can manage all, org members can read their own.

### Plan Editing Logic
The `SuperAdminPlans.tsx` page will:
1. Fetch all plans from `billing_plans`
2. Fetch limits from `plan_limits` grouped by plan
3. Fetch features from `plan_features` grouped by plan
4. Allow inline editing of prices, limits, and features
5. Save changes with audit logging
6. Support creating new custom plans

---

## Implementation Order

1. Database migration (organization_feature_overrides table)
2. Create 4 new super admin pages
3. Update AppLayout sidebar for super admin navigation
4. Update App.tsx routes
5. Build SuperAdminPlans page with plan/limit/feature editing
6. Enhance Features tab with granular permission and integration controls
7. Wire up feature overrides into AppLayout sidebar filtering

