
# Multi-Tenant Data Isolation - Critical Fix

## Problem Summary
When a client admin (e.g., `test@nikist.in` from "Test org") logs in, they see Nikist's data instead of their own organization's data. This is a **critical multi-tenancy isolation failure**.

## Root Cause Analysis

**Current State:**
- Every data table (leads, workshops, sales, etc.) has an `organization_id` column
- RLS policies only check user **role** (admin, sales_rep, etc.)
- Frontend queries don't filter by organization
- Result: Any authenticated user can see ALL data from ALL organizations

**Example - Current `leads` RLS:**
```sql
-- CURRENT (INSECURE)
Policy: "Users can view all leads"
USING: (auth.uid() IS NOT NULL)  -- Anyone logged in sees everything!
```

---

## Solution Overview

### Phase 1: Database RLS Policies (Security Layer)

Create a helper function and update RLS policies for ALL data tables to enforce organization isolation.

**1. Create Helper Function:**
```sql
CREATE OR REPLACE FUNCTION public.get_user_organization_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    ARRAY_AGG(organization_id),
    '{}'::uuid[]
  )
  FROM organization_members
  WHERE user_id = auth.uid()
$$;
```

**2. Update RLS Policies (Example for `leads` table):**
```sql
-- DROP existing permissive policy
DROP POLICY IF EXISTS "Users can view all leads" ON leads;

-- CREATE organization-scoped policy
CREATE POLICY "Users can view leads in their organization"
ON leads FOR SELECT
USING (
  organization_id = ANY(get_user_organization_ids())
  OR is_super_admin(auth.uid())
);

-- UPDATE write policies to enforce organization
DROP POLICY IF EXISTS "Sales reps and admins can create leads" ON leads;
CREATE POLICY "Users can create leads in their organization"
ON leads FOR INSERT
WITH CHECK (
  organization_id = ANY(get_user_organization_ids())
  OR is_super_admin(auth.uid())
);
```

**Tables Requiring RLS Updates:**
| Table | Organization Column |
|-------|-------------------|
| leads | organization_id |
| lead_assignments | organization_id |
| workshops | organization_id |
| products | organization_id |
| funnels | organization_id |
| sales | organization_id |
| call_appointments | organization_id |
| batches | organization_id |
| daily_money_flow | organization_id |
| emi_payments | organization_id |
| futures_mentorship_batches | organization_id |
| futures_mentorship_students | organization_id |
| high_future_batches | organization_id |
| high_future_students | organization_id |
| And more... |

### Phase 2: Frontend Query Updates (Application Layer)

Even with RLS, we should explicitly filter by organization for clarity and performance.

**1. Update `useOrganization` hook to expose organization ID:**
Already done - `currentOrganization.id` is available.

**2. Update all data queries to filter by organization:**

Example for Dashboard.tsx:
```typescript
// BEFORE (shows all data)
const { data } = await supabase.from("leads").select("*", { count: "exact" });

// AFTER (shows only current org's data)
const { currentOrganization } = useOrganization();
const { data } = await supabase
  .from("leads")
  .select("*", { count: "exact" })
  .eq("organization_id", currentOrganization?.id);
```

**Files Requiring Query Updates:**
| File | Tables Queried |
|------|---------------|
| src/pages/Dashboard.tsx | leads, workshops, sales |
| src/pages/Leads.tsx | leads, lead_assignments, workshops, products, funnels |
| src/pages/Workshops.tsx | workshops |
| src/pages/Calls.tsx | call_appointments |
| src/pages/Batches.tsx | batches |
| src/pages/Sales.tsx | sales |
| src/pages/DailyMoneyFlow.tsx | daily_money_flow |
| src/pages/FuturesMentorship.tsx | futures_mentorship_batches, futures_mentorship_students |
| src/pages/HighFuture.tsx | high_future_batches, high_future_students |
| src/pages/Users.tsx | profiles, user_roles |
| + many more components... |

### Phase 3: Insert Operations - Set Organization ID

When creating new records, automatically set `organization_id` to current organization.

```typescript
// Example: Creating a new lead
const { currentOrganization } = useOrganization();

await supabase.from("leads").insert({
  ...leadData,
  organization_id: currentOrganization?.id,
});
```

---

## Implementation Priority

### High Priority (Security Critical)
1. Create `get_user_organization_ids()` helper function
2. Update RLS policies for all data tables
3. Update main page queries (Dashboard, Leads, Workshops, Calls)

### Medium Priority
4. Update remaining page queries
5. Update insert operations to set organization_id
6. Update edge functions for organization context

### Lower Priority
7. Add organization context to realtime subscriptions
8. Update database functions (like `get_workshop_metrics`)

---

## Technical Details

### Migration SQL (Partial - First 5 Tables)

```sql
-- Helper function
CREATE OR REPLACE FUNCTION public.get_user_organization_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    ARRAY_AGG(organization_id),
    '{}'::uuid[]
  )
  FROM organization_members
  WHERE user_id = auth.uid()
$$;

-- LEADS table
DROP POLICY IF EXISTS "Users can view all leads" ON leads;
CREATE POLICY "Users can view leads in their organization"
ON leads FOR SELECT
USING (
  organization_id = ANY(get_user_organization_ids())
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Sales reps and admins can create leads" ON leads;
CREATE POLICY "Users can create leads in their organization"
ON leads FOR INSERT
WITH CHECK (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'sales_rep')))
  OR is_super_admin(auth.uid())
  OR auth.uid() IS NULL  -- Allow webhook inserts
);

DROP POLICY IF EXISTS "Sales reps and admins can update leads" ON leads;
CREATE POLICY "Users can update leads in their organization"
ON leads FOR UPDATE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'sales_rep')))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Only admins can delete leads" ON leads;
CREATE POLICY "Admins can delete leads in their organization"
ON leads FOR DELETE
USING (
  (organization_id = ANY(get_user_organization_ids()) 
   AND has_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- Similar patterns for workshops, sales, call_appointments, etc.
```

### Frontend Changes Pattern

```typescript
// Create a custom hook for organization-scoped queries
function useOrgQuery<T>(
  queryKey: string[],
  tableName: string,
  selectQuery: string = "*"
) {
  const { currentOrganization } = useOrganization();
  
  return useQuery({
    queryKey: [...queryKey, currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return null;
      
      const { data, error } = await supabase
        .from(tableName)
        .select(selectQuery)
        .eq("organization_id", currentOrganization.id);
        
      if (error) throw error;
      return data as T;
    },
    enabled: !!currentOrganization,
  });
}
```

---

## Expected Result

After implementation:
1. `test@nikist.in` logs in and sees only "Test org" data
2. Nikist users see only Nikist data
3. Super Admin can see all organizations (with switcher)
4. Data isolation is enforced at both RLS and application level
5. New records automatically get correct organization_id

---

## Risk Considerations

1. **Existing Data**: All existing data has `organization_id = 00000000-0000-0000-0000-000000000001` (Nikist). New orgs start empty.

2. **Edge Functions**: Need to pass organization context to edge functions for proper filtering.

3. **Webhooks**: External webhooks (Calendly, TagMango) need to determine organization from context.

4. **Migration Complexity**: This is a large change affecting 15+ tables and 20+ pages.
