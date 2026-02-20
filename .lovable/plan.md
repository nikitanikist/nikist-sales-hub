

# Super Admin Dashboard Enhancement - Complete Updated Plan

## Overview

This is the comprehensive plan incorporating all feedback from your senior developer. The implementation adds subscription management, revenue analytics, payment tracking, usage monitoring, and several critical additions: default plan on org creation, subscription auto-expiry cron job, CSV exports, Nikist migration, limit enforcement, audit logging, and notification system.

---

## Phase 1: Database Foundation + Nikist Migration

### Tables to Create (8 tables total -- 6 original + 2 new)

| Table | Purpose |
|-------|---------|
| `billing_plans` | Plan definitions (Starter, Growth, Pro, Enterprise) |
| `plan_limits` | Per-plan resource limits |
| `plan_features` | Per-plan feature flags |
| `organization_subscriptions` | Active subscription per org (with new fields: `cancelled_reason`, `upgrade_from_plan_id`, `downgrade_date`) |
| `subscription_payments` | Manual payment history log |
| `organization_usage` | Current usage metrics per org per period |
| `subscription_audit_log` | **NEW** -- Track who changed what and when |
| `subscription_notifications` | **NEW** -- Track sent notifications to avoid duplicates |

### Additional Fields on `organization_subscriptions`

As suggested by senior developer:
- `cancelled_reason TEXT` -- Why was it cancelled?
- `upgrade_from_plan_id UUID REFERENCES billing_plans(id)` -- Track plan changes
- `downgrade_date TIMESTAMPTZ` -- When downgrade takes effect

### Audit Log Table

```text
subscription_audit_log
  - id UUID PK
  - subscription_id UUID FK
  - action TEXT ('created', 'plan_changed', 'status_changed', 'payment_recorded', 'limits_overridden')
  - old_value JSONB
  - new_value JSONB
  - performed_by UUID FK -> profiles(id)
  - performed_at TIMESTAMPTZ DEFAULT NOW()
```

### RLS Policies

- Plans/limits/features: readable by everyone, manageable by super admins only
- Subscriptions/payments/usage/audit: org members can view their own, super admins can manage all
- Uses existing `is_super_admin()` and `get_user_organization_ids()` functions

### Seed Data

- 4 billing plans (Starter $35/mo, Growth $35/mo, Pro $49/mo, Enterprise custom)
- Plan limits for all 4 plans (whatsapp_numbers, team_members, groups_synced, campaigns_per_month, recipients_per_campaign, dynamic_links)
- Plan features for all 4 plans (analytics, community_creation, data_export, support_channel, onboarding_minutes, etc.)

### Nikist Organization Migration

- Create a subscription record for the existing Nikist organization
- Default to **Pro** plan (since Nikist is the primary/power-user org)
- Set `subscription_started_at` to the organization's `created_at` date
- Set status to `active`, billing cycle to `monthly`
- Log initial audit entry as "migrated"

---

## Phase 2: Analytics Dashboard + Export Buttons

### New Component: `src/components/super-admin/AnalyticsDashboard.tsx`

**Stats Cards (5 cards replacing the current 4):**
- MRR (Monthly Recurring Revenue) with month-over-month % change
- Total Organizations (with "new this month" count)
- Paid Users
- Free Trial (with "expiring soon" count)
- Inactive

**Charts (using Recharts):**
- Plan Distribution bar chart (Starter/Growth/Pro/Enterprise)
- Revenue Trend line chart (last 6 months)

**Upcoming Renewals/Expirations Table:**
- Org name, plan, status, expiration date
- Sorted by nearest expiration first

**Export Buttons (NEW):**
- "Export Revenue Report" -- CSV with org name, plan, MRR contribution, status, dates
- "Export Organization List" -- CSV with all orgs + subscription details
- "Export Payment History" -- CSV with all payments across all orgs

Uses the `xlsx` library (already installed) for CSV generation.

### New Hook: `src/hooks/useSubscriptions.ts`
- Fetch all subscriptions with plan details via join
- Calculate MRR from active subscriptions (sum of monthly prices, yearly / 12 for annual)
- Get trial expirations (trials ending within 7 days)
- Get upcoming renewals (subscriptions with `current_period_end` within 14 days)

---

## Phase 3: Subscription Management Tab

### New Component: `src/components/super-admin/SubscriptionManager.tsx`

Added as a new "Subscription" tab in the org detail panel (alongside Details, Members, Features).

**Features:**
- Plan selector dropdown (Starter/Growth/Pro/Enterprise)
- Status selector (trial, active, past_due, cancelled, expired)
- Billing cycle toggle (monthly/yearly)
- Auto-calculated price display
- Custom price override field
- Date pickers: subscription start, current period start/end, next payment due
- Trial dates (shown only when status = trial)
- Setup fee tracking (amount + paid checkbox)
- Custom limit overrides (JSONB field for enterprise/custom deals)
- Admin notes textarea
- "Save Changes" button
- "Cancel Subscription" button with reason prompt

All changes are logged to `subscription_audit_log` automatically.

### New Hook: `src/hooks/usePlanLimits.ts`
- Get organization's current plan limits
- Merge with custom_limits overrides from subscription
- Provide enforcement check functions

---

## Phase 4: Payment History

### New Component: `src/components/super-admin/PaymentHistory.tsx`

Displayed within the Subscription tab.

**Features:**
- Payment history table (date, amount, type, method, status, reference)
- "Record Payment" dialog for manual entry
- Payment types: setup_fee, subscription, addon, refund
- Payment methods: manual, bank_transfer, UPI, cash, other
- Payment reference field (invoice number, transaction ID)
- Each payment logs an audit entry

---

## Phase 5: Usage Tracking + Limit Enforcement

### New Component: `src/components/super-admin/UsageTracker.tsx`

Added as a "Usage" tab in the org detail panel.

**Features:**
- Progress bars for each limit:
  - WhatsApp Numbers (count from org_integrations or similar)
  - Team Members (count from organization_members)
  - Groups Synced (count from whatsapp_groups)
  - Campaigns This Month (count from notification_campaigns)
  - Messages Sent This Month (count from notification_campaign_groups)
- Warning indicator at 80%+ usage (amber), critical at 100% (red)
- Current period display

### New Hook: `src/hooks/useOrganizationUsage.ts`
- Query actual counts from existing tables (organization_members, whatsapp_groups, notification_campaigns, etc.)
- Compare against plan limits (including custom overrides)
- Return usage percentage and limit status

### Limit Enforcement Points (NEW)

Create a reusable hook `src/hooks/useLimitCheck.ts` that can be called before actions:

| Action | Where to Enforce | Limit Key |
|--------|-----------------|-----------|
| Adding team member | `manage-users` edge function | `team_members` |
| Connecting WhatsApp number | AISensy settings | `whatsapp_numbers` |
| Syncing groups | WhatsApp groups sync | `groups_synced` |
| Creating campaign | `SendNotification.tsx` | `campaigns_per_month` |

Enforcement will show a toast: "You've reached the limit for [resource] on your [Plan] plan. Please upgrade or contact support."

---

## Phase 6: Organization List Enhancement + Create Org Dialog Update

### Organization List Sidebar Enhancement

Each org card in the sidebar will show:
- Plan badge (color-coded: Starter=gray, Growth=blue, Pro=purple, Enterprise=amber)
- Subscription status indicator dot (green=active, yellow=trial, red=past_due, gray=inactive)
- Trial expiration countdown ("2 days left") when applicable

### Create Organization Dialog Update (NEW)

Add to the existing "Create Organization" dialog:
- Plan selector dropdown (default to Starter)
- Trial toggle: "Start with 30-day trial?" (default: on)
- When org is created, auto-create a subscription record with:
  - Selected plan
  - Status = 'trial' or 'active' based on toggle
  - Trial dates calculated (30 days from now if trial)
  - All modules enabled (existing behavior preserved)

---

## Phase 7: Subscription Status Auto-Update Cron Job (NEW)

### New Edge Function: `supabase/functions/check-subscription-status/index.ts`

Daily cron job that:
1. Finds subscriptions where `status = 'trial'` and `trial_ends_at < NOW()` -- marks as `expired`
2. Finds subscriptions where `status = 'active'` and `current_period_end < NOW()` and no recent payment -- marks as `past_due`
3. Finds subscriptions where `status = 'past_due'` and `current_period_end < NOW() - INTERVAL '30 days'` -- marks as `expired`
4. Logs all changes to `subscription_audit_log` with `performed_by = NULL` (system action)

Scheduled via pg_cron to run daily at midnight IST.

---

## Phase 8: Notification System (NEW - Lightweight)

### Integrated into the cron job (`check-subscription-status`)

When the cron job detects:
- Trial expiring in 3 days: insert a record into `subscription_notifications` table
- Subscription expired: insert notification record
- Organization approaching 80% of any limit: insert notification record

### Super Admin Dashboard Notification Bell

- Show a notification count badge on the dashboard
- Click to see recent notifications (trial expiring, past due, limits approaching)
- Mark as read/dismiss

This is a lightweight in-app notification -- no email integration needed initially.

---

## Files Summary

### New Files to Create (12 files)

| File | Purpose |
|------|---------|
| `src/components/super-admin/AnalyticsDashboard.tsx` | Revenue and user analytics + export |
| `src/components/super-admin/SubscriptionManager.tsx` | Plan and subscription management |
| `src/components/super-admin/PaymentHistory.tsx` | Payment tracking |
| `src/components/super-admin/UsageTracker.tsx` | Usage monitoring |
| `src/components/super-admin/SubscriptionNotifications.tsx` | Notification bell + list |
| `src/hooks/useSubscriptions.ts` | Subscription data + MRR hook |
| `src/hooks/usePlanLimits.ts` | Plan limits hook |
| `src/hooks/useOrganizationUsage.ts` | Usage tracking hook |
| `src/hooks/useLimitCheck.ts` | Limit enforcement hook |
| `supabase/functions/check-subscription-status/index.ts` | Daily cron for auto-status updates |

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/SuperAdminDashboard.tsx` | Replace stats with AnalyticsDashboard, add Subscription/Usage tabs, update org list cards, add plan selector to create dialog, add notification bell |
| `supabase/config.toml` | Add `check-subscription-status` function config |
| `src/pages/whatsapp/SendNotification.tsx` | Add campaign limit check before creating |
| `supabase/functions/manage-users/index.ts` | Add team member limit check |

---

## Implementation Order

1. **Database migration** -- all 8 tables, indexes, RLS, seed data, Nikist migration
2. **Hooks** -- useSubscriptions, usePlanLimits, useOrganizationUsage, useLimitCheck
3. **AnalyticsDashboard** -- stats cards, charts, renewals table, export buttons
4. **SubscriptionManager + PaymentHistory** -- new tabs in org detail
5. **UsageTracker** -- usage tab with progress bars
6. **Org list enhancement + Create Org dialog update** -- badges, plan selector
7. **Cron job edge function** -- auto-status updates
8. **Notification system** -- bell icon + notification list
9. **Limit enforcement** -- integrate useLimitCheck at enforcement points

---

## Checklist

### Before Starting
- Existing modules system stays unchanged
- No breaking changes to current SuperAdminDashboard functionality

### Phase 1 Validation
- All 8 tables created with correct columns
- RLS policies use existing helper functions
- Seed data includes all 4 plans with correct limits and features
- Nikist org gets a Pro subscription record
- Audit log table exists

### Phase 2-5 Validation
- Components use existing shadcn/ui patterns
- Charts use Recharts
- All forms have proper validation
- Loading states and error handling throughout
- Export generates valid CSV files

### Phase 6 Validation
- Org creation includes plan selection and trial toggle
- Org list shows subscription badges and status
- No breaking changes to existing features

### Phase 7-8 Validation
- Cron job correctly transitions statuses
- Notifications appear for trials expiring in 3 days
- Limit enforcement shows clear error messages

