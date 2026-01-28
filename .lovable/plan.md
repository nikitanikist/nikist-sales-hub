
## Multi-Tenant SaaS Transformation Plan

### Executive Summary

Transform the current single-tenant CRM into a multi-tenant SaaS product with the following hierarchy:
- **Super Admin** → Manages all organizations and has full cross-org CRM access
- **Organizations** → Isolated business units (your coaching clients)
- **Organization Admins** → Full access to their organization's data
- **Sub-roles** → Managers, Sales Reps, Viewers within each organization

---

### New Role Hierarchy

```text
Super Admin (You - Product Owner)
    │
    ├── Organization A
    │   ├── Admin (Coach's primary user)
    │   ├── Manager
    │   ├── Sales Rep (Closer)
    │   └── Viewer
    │
    ├── Organization B
    │   ├── Admin
    │   ├── Manager
    │   └── Sales Rep
    │
    └── Organization C
        └── Admin
```

---

### Database Schema Changes

#### New Tables

| Table | Purpose |
|-------|---------|
| `organizations` | Store organization details (name, logo, settings, created_at) |
| `organization_features` | Track which features are enabled per organization |
| `organization_members` | Link users to organizations with their role |

#### Modified Tables (Add `organization_id`)

All business data tables need an `organization_id` column:
- `leads`
- `lead_assignments`
- `call_appointments`
- `batches`
- `futures_mentorship_batches`
- `futures_mentorship_students`
- `high_future_batches`
- `high_future_students`
- `workshops`
- `funnels`
- `products`
- `daily_money_flow`
- `emi_payments`
- `futures_emi_payments`
- `high_future_emi_payments`
- `sales`
- (and related history/audit tables)

#### Updated Role Enum

```sql
-- Add super_admin to existing app_role enum
ALTER TYPE app_role ADD VALUE 'super_admin';
```

---

### New Table Schemas

#### 1. Organizations Table

```sql
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,  -- URL-friendly identifier
  logo_url text,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### 2. Organization Features Table

```sql
CREATE TABLE public.organization_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  feature_key text NOT NULL,  -- e.g., 'batch_icc', 'futures_mentorship'
  is_enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, feature_key)
);
```

#### 3. Organization Members Table

```sql
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'viewer',
  is_org_admin boolean DEFAULT false,  -- True if they're the org's admin
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, user_id)
);
```

---

### RLS (Row Level Security) Strategy

All business tables will use organization-based isolation:

```sql
-- Example for leads table
CREATE POLICY "Users can view leads in their organization"
  ON leads FOR SELECT
  USING (
    -- Super admins can see everything
    has_role(auth.uid(), 'super_admin')
    OR
    -- Users can see data in their organization
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om 
      WHERE om.user_id = auth.uid()
    )
  );
```

Security definer functions needed:

```sql
-- Check if user is super admin
CREATE FUNCTION is_super_admin(_user_id uuid) RETURNS boolean ...

-- Get user's organization(s)
CREATE FUNCTION get_user_organizations(_user_id uuid) RETURNS uuid[] ...

-- Check if user has feature access
CREATE FUNCTION has_org_feature(_org_id uuid, _feature text) RETURNS boolean ...
```

---

### Feature Control System

Features will be controlled per organization:

| Feature Key | Description |
|-------------|-------------|
| `dashboard` | Access to dashboard |
| `daily_money_flow` | Money flow tracking |
| `customers` | Lead/customer management |
| `call_schedule` | 1:1 call scheduling |
| `batch_icc` | Insider Crypto Club batches |
| `batch_futures` | Futures Mentorship |
| `batch_high_future` | High Future program |
| `workshops` | Workshop management |
| `sales` | Sales tracking |
| `funnels` | Funnel management |
| `products` | Product catalog |
| `users` | User management (for org admins) |
| `integrations` | Calendly, WhatsApp, etc. |

Super Admin can toggle these per organization from their dashboard.

---

### UI Changes

#### Super Admin Dashboard (New)

```text
┌─────────────────────────────────────────────────────────────────┐
│ 🏢 Super Admin Dashboard                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Organizations (3 active)                                       │
│  ┌──────────────┬──────────────┬──────────────┬───────────────┐ │
│  │ Nikist       │ Crypto Coach │ Trade Mentor │ + Add Org    │ │
│  │ 5 users      │ 3 users      │ 8 users      │               │ │
│  │ [Enter]      │ [Enter]      │ [Enter]      │               │ │
│  └──────────────┴──────────────┴──────────────┴───────────────┘ │
│                                                                 │
│  Quick Stats (All Orgs)                                         │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                   │
│  │ Total Users│ │ Total Leads│ │ Revenue    │                   │
│  │ 16         │ │ 2,450      │ │ ₹45L       │                   │
│  └────────────┘ └────────────┘ └────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Organization Switcher (Header)

When Super Admin is viewing an org's CRM:

```text
┌─────────────────────────────────────────────────────────────────┐
│ [← Back to Super Admin] │ 🏢 Nikist ▼ │ 🔔 │ 👤               │
└─────────────────────────────────────────────────────────────────┘
```

#### Organization Settings (New Page)

For Super Admin when managing an organization:

- Organization details (name, logo)
- Feature toggles (checkboxes for each feature)
- User management (add admins, view all org users)
- Activity logs

---

### Implementation Phases

#### Phase 1: Database Foundation (Week 1)
- Create new tables (organizations, organization_features, organization_members)
- Add organization_id to all business tables
- Create security definer functions
- Update RLS policies

#### Phase 2: Super Admin Role (Week 1-2)
- Add super_admin to app_role enum
- Create Super Admin dashboard
- Implement organization CRUD
- Add organization switcher

#### Phase 3: Feature Control (Week 2)
- Implement feature toggle system
- Update sidebar filtering to check org features
- Update useUserRole hook to include org context

#### Phase 4: Data Migration (Week 2-3)
- Create a default organization for existing data
- Migrate all existing users to that organization
- Assign you as super_admin

#### Phase 5: Multi-Org User Management (Week 3)
- Update Users page for org admins
- Implement org-scoped user creation
- Update permissions system for org context

#### Phase 6: Org Admin Experience (Week 3-4)
- Org admin can create sub-admins, managers, closers
- Org admin can manage their users' permissions
- Org-scoped analytics and dashboards

---

### Files to Create

| File | Purpose |
|------|---------|
| `src/pages/SuperAdminDashboard.tsx` | Super Admin home page |
| `src/pages/OrganizationSettings.tsx` | Manage single org |
| `src/hooks/useOrganization.tsx` | Current org context |
| `src/components/OrganizationSwitcher.tsx` | Dropdown to switch orgs |
| `src/components/FeatureGate.tsx` | Hide features not enabled |
| `supabase/functions/manage-organizations/index.ts` | Org CRUD operations |

### Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useUserRole.tsx` | Add org context, super_admin checks |
| `src/hooks/useAuth.tsx` | Include org selection on login |
| `src/components/AppLayout.tsx` | Add org switcher, super admin nav |
| `src/lib/permissions.ts` | Add org-level feature checks |
| `src/pages/Users.tsx` | Scope to current organization |
| `supabase/functions/manage-users/index.ts` | Add org_id to user creation |
| All query files | Add organization_id filters |

---

### Migration Strategy for Existing Data

```sql
-- 1. Create default organization for current data
INSERT INTO organizations (name, slug) 
VALUES ('Nikist', 'nikist');

-- 2. Assign all existing users to this org
INSERT INTO organization_members (organization_id, user_id, role, is_org_admin)
SELECT 
  (SELECT id FROM organizations WHERE slug = 'nikist'),
  user_id,
  role,
  (role = 'admin')
FROM user_roles;

-- 3. Update all business tables
UPDATE leads SET organization_id = (SELECT id FROM organizations WHERE slug = 'nikist');
UPDATE batches SET organization_id = (SELECT id FROM organizations WHERE slug = 'nikist');
-- ... repeat for all tables

-- 4. Create super_admin user (you)
-- This will be done via edge function
```

---

### Technical Considerations

#### Authentication Flow Changes

```text
Login → Check if super_admin → 
    Yes → Show Super Admin Dashboard
    No → Check organization membership →
        Single org → Load that org's CRM
        Multiple orgs → Show org selector
```

#### Query Changes Example

Before:
```typescript
const { data } = await supabase.from('leads').select('*');
```

After:
```typescript
const { data } = await supabase
  .from('leads')
  .select('*')
  .eq('organization_id', currentOrgId);  // From context
```

#### Edge Function Updates

All edge functions that create/modify data need to:
1. Accept organization_id parameter
2. Validate user has access to that organization
3. Include organization_id in all inserts

---

### Summary

This transformation is **definitely possible** with the current architecture. The main work involves:

1. **Database**: Adding organization_id to ~20 tables + new org management tables
2. **RLS**: Updating all policies to include organization checks
3. **UI**: New Super Admin dashboard + org switcher + feature gates
4. **Backend**: Updating edge functions for multi-tenant awareness
5. **Migration**: Moving existing data to a default organization

The estimated effort is **3-4 weeks** for a complete implementation, broken into the phases outlined above.

Shall I proceed with Phase 1 (Database Foundation) first?
