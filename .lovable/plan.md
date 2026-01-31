
# Fix: Non-Admin Team Members Cannot Use the Portal

## Problem

Team members in the Nickist organization (like Shivani) cannot update any records, while the admin (Nikita) can work fine.

## Root Cause

The system has a **mismatch between where roles are stored and where RLS policies check for roles**:

| User | organization_members.role | user_roles.role | Can Update? |
|------|--------------------------|-----------------|-------------|
| Nikita | admin | admin | Yes |
| Shivani | admin | viewer | No |
| Chanchal | admin | admin | Yes |
| Suman | manager | manager | Yes |

When Shivani tries to update a record, the database RLS policy runs:
```sql
has_role(auth.uid(), 'admin')  -- Checks user_roles table
```

But Shivani's role in `user_roles` is "viewer" (not admin), so **RLS blocks her operation**.

The current `has_role()` function only checks the **global** `user_roles` table, not the **organization-specific** role in `organization_members`.

## Solution Options

### Option A: Create New Organization-Aware Role Check Function (Recommended)

Create a new database function that checks the organization-specific role from `organization_members` table, then update all RLS policies to use this new function.

**Pros:**
- Aligns with multi-tenant architecture design
- Each user can have different roles in different organizations
- Cleaner long-term solution

**Cons:**
- Requires updating many RLS policies
- More complex migration

### Option B: Sync user_roles with organization_members (Quick Fix)

Keep the current RLS policies but ensure `user_roles` is always synced with the user's role in their current organization.

**Pros:**
- Minimal changes to RLS policies
- Quick to implement

**Cons:**
- Breaks multi-tenant role separation (user can only have one global role)
- Creates data synchronization complexity

---

## Recommended Implementation: Option A

### Step 1: Create Organization-Aware Role Check Function

Create a new function `has_org_role()` that checks `organization_members.role`:

```sql
CREATE OR REPLACE FUNCTION public.has_org_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND role = _role
  )
$$;
```

### Step 2: Update RLS Policies on All Tables

Replace `has_role()` with `has_org_role()` in all affected RLS policies. Example for `call_appointments`:

```sql
-- Update policy
DROP POLICY IF EXISTS "Users can update appointments in their organization" ON call_appointments;

CREATE POLICY "Users can update appointments in their organization"
ON call_appointments
FOR UPDATE
TO authenticated
USING (
  (
    (organization_id = ANY (get_user_organization_ids()))
    AND (
      has_org_role(auth.uid(), 'admin')
      OR has_org_role(auth.uid(), 'sales_rep')
      OR has_org_role(auth.uid(), 'manager')
    )
  )
  OR is_super_admin(auth.uid())
);
```

### Tables Requiring Policy Updates

Based on the security scan, these tables use `has_role()` in their RLS policies:

1. `call_appointments` - INSERT, UPDATE, DELETE
2. `leads` - INSERT, UPDATE, DELETE
3. `lead_assignments` - INSERT, UPDATE, DELETE
4. `cohort_students` - INSERT, UPDATE, DELETE, SELECT
5. `batch_students` - INSERT, UPDATE, DELETE, SELECT
6. `futures_mentorship_students` - INSERT, UPDATE, DELETE, SELECT
7. `high_future_students` - INSERT, UPDATE, DELETE, SELECT
8. `emi_payments` - UPDATE, DELETE
9. `cohort_emi_payments` - INSERT, UPDATE, DELETE
10. `futures_emi_payments` - INSERT, UPDATE, DELETE
11. `high_future_emi_payments` - INSERT, UPDATE, DELETE
12. `money_flow_entries` / `daily_money_flow` - INSERT, UPDATE, DELETE
13. `workshops` - INSERT, UPDATE, DELETE
14. `funnels` - INSERT, UPDATE, DELETE
15. `products` - INSERT, UPDATE, DELETE
16. `sales` - INSERT, UPDATE, DELETE
17. `whatsapp_message_templates` - INSERT, UPDATE, DELETE
18. `template_sequences` - INSERT, UPDATE, DELETE
19. `template_sequence_steps` - INSERT, UPDATE, DELETE
20. `workshop_tags` - INSERT, UPDATE, DELETE
21. `webhook_ingest_events` - SELECT

### Step 3: Fix Existing Data

For Shivani and any other users with mismatched roles, update the `user_roles` table to match their primary organization role (as a fallback):

```sql
-- Fix Shivani's global role to match her org role
UPDATE user_roles 
SET role = 'admin'
WHERE user_id = '2361e8ab-3703-423f-94e1-aeb00313978d';
```

However, this is just a temporary fix - the RLS policy changes are the proper solution.

---

## Implementation Summary

| Step | Description | Effort |
|------|-------------|--------|
| 1 | Create `has_org_role()` function | Low |
| 2 | Update RLS policies on 20+ tables | Medium |
| 3 | Fix Shivani's user_roles record (temporary) | Low |
| 4 | Update `manage-users` edge function to sync roles | Low |

---

## Immediate Fix While Full Solution is Implemented

As a quick fix to unblock Shivani immediately, we can update her `user_roles` entry:

```sql
UPDATE user_roles 
SET role = 'admin'
WHERE user_id = '2361e8ab-3703-423f-94e1-aeb00313978d';
```

This will make the current `has_role()` function return true for admin checks, unblocking her access while the proper RLS policy migration is completed.
