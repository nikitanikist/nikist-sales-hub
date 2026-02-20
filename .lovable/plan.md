

# Improve Subscription Plans Page - Currency Selection and Toggle-Based Features

## What's Changing

The Plans page (`/super-admin/plans`) will be upgraded with:
1. **Currency selector** on pricing fields (INR, USD, EUR, GBP, etc.)
2. **Toggle-based features** instead of free-text inputs -- matching the same feature list used in the Organizations Features tab (sidebar permissions + integrations + modules)
3. A `currency` column added to the `billing_plans` table

---

## 1. Database Change

Add a `currency` column to the `billing_plans` table:

```text
ALTER TABLE billing_plans
  ADD COLUMN currency TEXT NOT NULL DEFAULT 'INR';
```

No other schema changes needed -- the existing `plan_features` table already stores key-value pairs, and we'll use the same keys with `"true"/"false"` values for toggle features.

---

## 2. Pricing Tab Improvements

Current layout has Plan Name, Monthly Price, Yearly Price, Description, and Active toggle.

Updated layout:

| Field | Type |
|---|---|
| Plan Name | Text input |
| Currency | Dropdown (INR, USD, EUR, GBP) |
| Monthly Price | Number input with currency symbol prefix |
| Yearly Price | Number input with currency symbol prefix |
| Description | Text input |
| Active | Toggle switch |

The currency selector will be a `Select` dropdown. The plan card display will also show the correct currency symbol based on the selected currency.

---

## 3. Features Tab Overhaul

Replace the current free-text inputs with a **toggle-based layout** organized in sections -- mirroring the Organization Features tab structure:

**Section A: Core Modules**
Toggles for each module from the `modules` table (One-to-One Sales Funnel, Cohort Management, Workshops, Daily Money Flow).

**Section B: Sidebar Permissions**
Grouped toggles matching `PERMISSION_GROUPS` from `permissions.ts`:
- Finance (Daily Money Flow, Sales)
- Customers (All Customers, Customer Insights)
- Closers (1:1 Call Schedule, Sales Closers)
- Funnels (All Workshops, Active Funnels, Products)
- Cohort Batches
- WhatsApp
- Other (Dashboard, Team Members, Settings)

**Section C: Integration Access**
Toggles for: Calendly, WhatsApp (AISensy), Pabbly Webhook, Workshop Notifications

**Section D: Additional Features**
Keep the existing features as toggles where applicable:
- Analytics Level (dropdown: basic/standard/advanced)
- Community Creation (toggle)
- Data Export (toggle)
- Custom Branding (toggle)
- Support Channel (dropdown: email/chat/priority/dedicated)
- Onboarding Minutes (number input)

Each toggle ON means the feature is **included** in the plan. Toggle OFF means it is **not included**. When a new organization subscribes to this plan, these defaults will be pre-applied.

The feature values will be stored in `plan_features` as before, using `"true"/"false"` for boolean features.

---

## Technical Details

### Files to Modify

| File | Changes |
|---|---|
| `src/pages/super-admin/SuperAdminPlans.tsx` | Complete overhaul of Features tab (toggles), add currency selector to Pricing tab, update plan cards to show currency symbol |

### Migration
One migration to add the `currency` column to `billing_plans`.

### Currency Support
A simple mapping object:
```text
{ INR: "₹", USD: "$", EUR: "€", GBP: "£" }
```

### Feature Keys for Plan-Level Toggles
The plan_features rows will include keys like:
- `perm_daily_money_flow`, `perm_customers`, `perm_whatsapp`, etc. (for sidebar permissions)
- `integration_calendly`, `integration_aisensy`, etc. (for integrations)
- `module_sales_funnel`, `module_cohort`, etc. (for modules)
- Plus existing keys: `analytics`, `community_creation`, `data_export`, `custom_branding`, `support_channel`, `onboarding_minutes`

Values: `"true"` / `"false"` for toggles, text for dropdowns/numbers.

### New Plan Dialog
The "Create New Plan" dialog will also be updated to include the currency selector.

