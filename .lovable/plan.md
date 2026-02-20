

# Add "My Plan" Page for Organization Admins

## What's Changing

A new "My Plan" sidebar item and page will be added for organization admins/members. When they click it, they'll see their current subscription details -- plan name, status, billing cycle, pricing, and expiry/renewal dates.

---

## 1. New Sidebar Item

Add a "My Plan" menu item to the regular (non-super-admin) sidebar in `AppLayout.tsx`, placed just above "Settings":

| Field | Value |
|---|---|
| Title | My Plan |
| Icon | CreditCard (from lucide-react) |
| Path | /my-plan |
| Permission | settings (reuse existing -- only admins see it) |

---

## 2. New Page: `/my-plan`

A read-only page showing the organization's current subscription. It will query `organization_subscriptions` joined with `billing_plans` filtered by the current organization ID.

**Displayed Information:**
- Plan name and tier badge (Starter / Growth / Pro / Enterprise)
- Status badge (Active, Trial, Expired, Past Due)
- Billing cycle (Monthly / Yearly)
- Current price (with currency symbol)
- Current period start and end dates
- Next payment due date
- Trial details (if on trial): trial start, trial end, days remaining
- Subscription started date

**Layout:** A clean card-based layout with the plan name prominently displayed, status badge, and a details grid below.

---

## Technical Details

### New Files

| File | Purpose |
|---|---|
| `src/pages/MyPlan.tsx` | The plan details page |

### Files to Modify

| File | Changes |
|---|---|
| `src/components/AppLayout.tsx` | Add "My Plan" menu item (CreditCard icon) before Settings in `allMenuItems` |
| `src/App.tsx` | Add route `/my-plan` pointing to `MyPlan` component |
| `src/lib/permissions.ts` | Add `my_plan` permission key, add to ROUTE_TO_PERMISSION, PERMISSION_LABELS, and DEFAULT_PERMISSIONS for admin role |

### Data Fetching

The page will use a hook that queries:
```text
supabase
  .from("organization_subscriptions")
  .select("*, billing_plans!organization_subscriptions_plan_id_fkey(*)")
  .eq("organization_id", currentOrganization.id)
  .single()
```

This reuses the existing `organization_subscriptions` and `billing_plans` tables -- no database changes needed.

### No Database Migration Required

All required tables and columns already exist (`organization_subscriptions`, `billing_plans` with `currency` column). RLS policies already allow org members to read their own subscription.

