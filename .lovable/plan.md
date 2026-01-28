
# Complete Multi-Tenant Data Isolation Fix

## Executive Summary

A critical security flaw exists where users from one organization can see data from all organizations. This comprehensive fix addresses the Users page bug and many other discovered issues across the entire application.

---

## Issues Discovered

### Critical Issues (Security)

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 1 | **Users page shows ALL users** | `src/pages/Users.tsx` | Org admins see all users, not just their organization members |
| 2 | **Profiles table is world-readable** | RLS policy: `USING (true)` | Anyone can query all user emails, phones, names |
| 3 | **Customer onboarding allows unauthenticated inserts** | `customer_onboarding`, `leads` tables | Spam/abuse vulnerability |
| 4 | **Edge functions don't filter by organization** | `manage-users`, `schedule-calendly-call`, etc. | Cross-org data manipulation possible |
| 5 | **Role is global, not per-organization** | `user_roles` table | User has same role everywhere |

### High Priority Issues

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 6 | **Database functions not org-aware** | `get_workshop_metrics`, `search_leads`, etc. | Returns data across all orgs |
| 7 | **user_permissions table not org-aware** | RLS policies | Permissions leak across orgs |
| 8 | **SalesClosers page shows all closers** | `src/pages/SalesClosers.tsx` | Shows closers from all organizations |
| 9 | **Calls page shows all appointments** | `src/pages/Calls.tsx` | No org filter |
| 10 | **Products/Funnels shared across orgs** | `src/pages/Products.tsx` | Shows all products |

### Medium Priority Issues

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 11 | **Insert operations missing org_id** | Multiple pages | New records may go to wrong org |
| 12 | **Edge functions use service role without org context** | All edge functions | Bypass RLS entirely |
| 13 | **Profiles table lacks organization linking** | `profiles` table | Can't filter users by org |

---

## Root Cause Analysis

The current architecture has fundamental flaws:

1. **User ≠ Organization Member**: The `profiles` table stores users, but there's no RLS limiting which profiles an org admin can see.

2. **Roles are Global**: The `user_roles` table assigns a role to a user globally, not per-organization. The `organization_members` table HAS a `role` column, but it's not being used.

3. **The Users Page Queries Wrong Tables**: It queries `profiles` and `user_roles` directly, which have no organization filtering.

4. **Edge Functions Bypass RLS**: They use `SUPABASE_SERVICE_ROLE_KEY` which bypasses all RLS, and don't filter by organization.

---

## Solution Architecture

### New Multi-Tenant User Management Model

```text
+-------------------+     +------------------------+     +----------------+
| organizations     |     | organization_members   |     | profiles       |
+-------------------+     +------------------------+     +----------------+
| id (PK)           |<----| organization_id (FK)   |     | id (PK)        |
| name              |     | user_id (FK)           |---->| full_name      |
| slug              |     | role                   |     | email          |
+-------------------+     | is_org_admin           |     | phone          |
                          +------------------------+     +----------------+
```

**Key Changes:**
1. Users page fetches from `organization_members` + `profiles`, not `user_roles` + `profiles`
2. Role comes from `organization_members.role` for the current org
3. `profiles` RLS restricts visibility to same-org members
4. Edge functions receive `organization_id` and filter accordingly

---

## Implementation Plan

### Phase 1: Fix Critical Security Issues

#### 1.1 Fix Profiles Table RLS (Database)

Replace the permissive `USING (true)` SELECT policy:

```sql
-- Drop the dangerous policy
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;

-- New policy: users can only see profiles of people in their organizations
CREATE POLICY "Users can view profiles in their organizations"
ON profiles FOR SELECT
USING (
  id = auth.uid()  -- Always see own profile
  OR id IN (
    SELECT om2.user_id 
    FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid()
  )
  OR is_super_admin(auth.uid())
);
```

#### 1.2 Require Login for Onboarding Form (Frontend + Backend)

Since user confirmed login is required:

**`src/App.tsx`** - Wrap onboarding route in ProtectedRoute:
```typescript
// Before
<Route path="/onboarding" element={<Onboarding />} />

// After  
<Route element={<AppLayout />}>
  ...
  <Route path="/onboarding" element={<Onboarding />} />
</Route>
```

**`src/pages/Onboarding.tsx`** - Add organization context:
```typescript
import { useOrganization } from "@/hooks/useOrganization";

// In submit handler:
const { currentOrganization } = useOrganization();

// Add organization_id to inserts
.insert({
  ...leadData,
  organization_id: currentOrganization?.id,
})
```

**Database** - Remove unauthenticated insert policies:
```sql
DROP POLICY IF EXISTS "Anyone can create onboarding records" ON customer_onboarding;
CREATE POLICY "Users can create onboarding in their organization"
ON customer_onboarding FOR INSERT
WITH CHECK (
  organization_id = ANY(get_user_organization_ids())
  OR is_super_admin(auth.uid())
);
```

---

### Phase 2: Fix Users Page (Critical Fix)

#### 2.1 Rewrite Users.tsx Query Logic

The Users page must:
1. Use `useOrganization` to get current org
2. Query `organization_members` filtered by org
3. Join with `profiles` for user details
4. Use `organization_members.role` instead of `user_roles.role`

**`src/pages/Users.tsx`** - New query:

```typescript
import { useOrganization } from "@/hooks/useOrganization";

const Users = () => {
  const { currentOrganization } = useOrganization();
  
  const { data: users, isLoading } = useQuery({
    queryKey: ["org-users", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      
      // Fetch organization members for current org only
      const { data: members, error } = await supabase
        .from("organization_members")
        .select(`
          id,
          user_id,
          role,
          is_org_admin,
          created_at,
          profiles!organization_members_user_id_fkey (
            id,
            full_name,
            email,
            phone
          )
        `)
        .eq("organization_id", currentOrganization.id);
      
      if (error) throw error;
      
      // Map to expected format
      return (members || []).map(m => ({
        id: m.user_id,
        membership_id: m.id,
        full_name: m.profiles?.full_name || "",
        email: m.profiles?.email || "",
        phone: m.profiles?.phone || null,
        role: m.role,  // Use org-specific role
        is_org_admin: m.is_org_admin,
        role_created_at: m.created_at,
      }));
    },
    enabled: !!currentOrganization,
  });
```

#### 2.2 Update manage-users Edge Function

Add `organization_id` parameter and create organization membership:

```typescript
// In manage-users/index.ts

// Extract organization_id from request
const { action, organization_id, ...rest } = await req.json();

if (action === 'create') {
  // After creating auth user...
  
  // Add to organization_members (not just user_roles)
  if (organization_id) {
    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .insert({
        organization_id,
        user_id: authData.user.id,
        role: role,  // Use the role for this org
        is_org_admin: role === 'admin',
      });
    
    if (memberError) {
      console.error('Error creating org membership:', memberError);
      // Consider this critical - maybe throw
    }
  }
}
```

#### 2.3 Update Users.tsx Add User Handler

Pass `organization_id` when creating users:

```typescript
const { data, error } = await supabase.functions.invoke("manage-users", {
  body: {
    action: "create",
    organization_id: currentOrganization?.id,  // ADD THIS
    email: formData.email.trim(),
    full_name: formData.full_name.trim(),
    phone: formData.phone.trim() || null,
    role: formData.role,
    password: formData.password,
  },
});
```

---

### Phase 3: Fix Role Model (Per-Organization)

#### 3.1 Update useUserRole Hook

Change from global role lookup to org-specific:

```typescript
// In useUserRole.tsx - modify to accept organization context

export const useUserRole = (): UseUserRoleReturn => {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  
  // Instead of querying user_roles globally,
  // query organization_members for current org
  
  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user?.email || !currentOrganization) {
        setRole(null);
        return;
      }
      
      // Get profile ID
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", user.email)
        .maybeSingle();
      
      if (!profile) return;
      
      // Check if super admin first (global role)
      const { data: superAdminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", profile.id)
        .eq("role", "super_admin")
        .maybeSingle();
      
      if (superAdminRole) {
        setRole('super_admin');
        // Super admin has all permissions
        return;
      }
      
      // Get org-specific role from organization_members
      const { data: membership } = await supabase
        .from("organization_members")
        .select("role, is_org_admin")
        .eq("user_id", profile.id)
        .eq("organization_id", currentOrganization.id)
        .maybeSingle();
      
      if (membership) {
        setRole(membership.role);
        setIsOrgAdmin(membership.is_org_admin);
      }
    };
    
    fetchUserRole();
  }, [user?.email, currentOrganization?.id]);
```

---

### Phase 4: Fix Frontend Queries

#### 4.1 Add Organization Filtering to All Pages

Each page needs:
1. Import `useOrganization`
2. Add `organization_id` to query keys
3. Filter queries by organization
4. Set `organization_id` on inserts

**Files requiring updates:**

| File | Current State | Required Changes |
|------|--------------|------------------|
| `Dashboard.tsx` | No org filter | Add filter to stats queries |
| `Leads.tsx` | No org filter | Add filter to leads query |
| `Workshops.tsx` | No org filter | Add filter to workshops query |
| `Calls.tsx` | No org filter | Add filter to appointments query |
| `SalesClosers.tsx` | Shows all closers | Filter by org members |
| `Products.tsx` | No org filter | Add filter |
| `Batches.tsx` | No org filter | Add filter |
| `DailyMoneyFlow.tsx` | No org filter | Add filter |
| `FuturesMentorship.tsx` | No org filter | Add filter |
| `HighFuture.tsx` | No org filter | Add filter |
| `AllCloserCalls.tsx` | No org filter | Add filter |

**Example pattern for Workshops.tsx:**

```typescript
const { currentOrganization } = useOrganization();

const { data: workshops } = useQuery({
  queryKey: ["workshops", currentOrganization?.id],
  queryFn: async () => {
    if (!currentOrganization) return [];
    
    const { data, error } = await supabase
      .from("workshops")
      .select("*")
      .eq("organization_id", currentOrganization.id)  // ADD THIS
      .is("product_id", null)
      .order("start_date", { ascending: false });
    
    if (error) throw error;
    return data;
  },
  enabled: !!currentOrganization,
});
```

#### 4.2 Fix SalesClosers to Show Only Org Closers

```typescript
// Instead of querying user_roles for sales_rep globally,
// query organization_members for current org

const { data: closers } = useQuery({
  queryKey: ["org-sales-closers", currentOrganization?.id],
  queryFn: async () => {
    if (!currentOrganization) return [];
    
    const { data: members, error } = await supabase
      .from("organization_members")
      .select(`
        user_id,
        role,
        profiles!organization_members_user_id_fkey (
          id, full_name, email, phone
        )
      `)
      .eq("organization_id", currentOrganization.id)
      .eq("role", "sales_rep");
    
    if (error) throw error;
    
    // Get metrics for each closer...
  },
  enabled: !!currentOrganization,
});
```

---

### Phase 5: Fix Edge Functions

All edge functions that access data must either:
1. Accept and validate `organization_id` from the request
2. Extract organization from authenticated user's context

#### 5.1 Update manage-users Function

Already covered in Phase 2.2.

#### 5.2 Update Other Edge Functions

For functions like `reassign-call`, `rebook-call`, `schedule-calendly-call`:

```typescript
// Option 1: Inherit org from the appointment/lead being modified
const { data: appointment } = await supabase
  .from('call_appointments')
  .select('organization_id')
  .eq('id', appointment_id)
  .single();

// Use appointment.organization_id for any new records

// Option 2: Pass organization_id from frontend
const { organization_id, appointment_id, ... } = await req.json();
```

---

### Phase 6: Fix Database Functions

Database functions like `get_workshop_metrics`, `get_closer_call_metrics`, `search_leads` need organization parameters.

#### 6.1 Example: get_closer_call_metrics

```sql
-- Drop and recreate with org parameter
CREATE OR REPLACE FUNCTION public.get_closer_call_metrics(
  target_date date,
  org_id uuid  -- NEW PARAMETER
)
RETURNS TABLE(...) AS $$
BEGIN
  RETURN QUERY
  SELECT ...
  FROM profiles p
  INNER JOIN organization_members om 
    ON om.user_id = p.id 
    AND om.organization_id = org_id  -- FILTER BY ORG
    AND om.role = 'sales_rep'
  LEFT JOIN call_appointments ca 
    ON ca.closer_id = p.id 
    AND ca.scheduled_date = target_date
    AND ca.organization_id = org_id  -- FILTER BY ORG
  ...
END;
$$;
```

---

## Implementation Order

### Immediate (Today)

1. **Fix profiles RLS** - Critical security
2. **Fix Users.tsx query** - Main reported bug
3. **Fix manage-users edge function** - Required for #2

### This Week

4. **Update useUserRole hook** - Org-specific roles
5. **Move onboarding inside AppLayout** - Require login
6. **Add org filter to top 5 pages** - Dashboard, Leads, Workshops, Calls, SalesClosers

### Next Week

7. **Update remaining pages** - Products, Batches, etc.
8. **Update edge functions** - All that modify data
9. **Update database functions** - Add org parameters

---

## Testing Checklist

After implementation:

1. **Login as test@nikist.in (Test Org admin)**
   - [ ] Users page shows only Test Org members (should be empty or just this user)
   - [ ] Cannot see Nikist users
   - [ ] Dashboard shows only Test Org data (0 leads, 0 workshops)
   - [ ] Organization name shows "Test org" in sidebar

2. **Login as nikita@nikist.in (Nikist admin)**
   - [ ] Users page shows only Nikist members
   - [ ] All existing data visible
   - [ ] Cannot see Test Org members

3. **Login as Super Admin**
   - [ ] Can switch between organizations
   - [ ] Super Admin Dashboard shows all orgs
   - [ ] Can manage users in any org

4. **Create new user in Test Org**
   - [ ] User created successfully
   - [ ] User visible only in Test Org Users page
   - [ ] User has correct org-specific role

---

## Migration SQL Summary

```sql
-- 1. Fix profiles RLS
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
CREATE POLICY "Users can view profiles in their organizations" ...

-- 2. Add foreign key from organization_members to profiles
ALTER TABLE organization_members
ADD CONSTRAINT organization_members_user_id_fkey
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 3. Fix customer_onboarding RLS
DROP POLICY IF EXISTS "Anyone can create onboarding records" ON customer_onboarding;
CREATE POLICY "Users can create onboarding in their organization" ...

-- 4. Update database functions with org_id parameter
CREATE OR REPLACE FUNCTION get_closer_call_metrics(target_date date, org_id uuid) ...
CREATE OR REPLACE FUNCTION get_workshop_metrics(org_id uuid) ...
CREATE OR REPLACE FUNCTION search_leads(search_query text, org_id uuid) ...
```

---

## Files to Modify

| Category | Files |
|----------|-------|
| **Hooks** | `useUserRole.tsx`, `useOrganization.tsx` |
| **Pages** | `Users.tsx`, `Leads.tsx`, `Workshops.tsx`, `Calls.tsx`, `SalesClosers.tsx`, `Dashboard.tsx`, `Products.tsx`, `Batches.tsx`, `DailyMoneyFlow.tsx`, `FuturesMentorship.tsx`, `HighFuture.tsx`, `AllCloserCalls.tsx`, `Onboarding.tsx` |
| **Edge Functions** | `manage-users/index.ts`, `reassign-call/index.ts`, `rebook-call/index.ts`, `schedule-calendly-call/index.ts`, `manual-call-assignment/index.ts` |
| **App Routing** | `App.tsx` |
| **Database** | New migration for RLS policies and function updates |

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking existing workflows | Test thoroughly with both orgs before deploying |
| Data visibility regression | Verify Nikist admin still sees all Nikist data |
| Edge function failures | Deploy functions one at a time, monitor logs |
| Super Admin access | Super Admin bypasses org filters, test separately |

