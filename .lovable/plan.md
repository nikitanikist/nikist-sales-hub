

# Fix: Community Session Update Not Persisting

## Problem Identified

The community session dropdown selection is not being saved because of **RLS (Row Level Security) policy restrictions** on the `organizations` table.

Currently, only **super admins** can update organizations:
```sql
Policy: "Super admins can update organizations"
USING: is_super_admin(auth.uid())
```

When a regular user (even an org admin) tries to update `community_session_id`, the PATCH request succeeds with status 204, but **zero rows are actually updated** due to RLS blocking the write.

---

## Solution

Add a new RLS policy that allows **organization admins** to update their own organization's settings.

### Database Migration

```sql
-- Allow organization admins to update their own organization
CREATE POLICY "Org admins can update their organization"
ON public.organizations
FOR UPDATE
USING (
  is_org_admin(auth.uid(), id) 
  OR is_super_admin(auth.uid())
);
```

This policy allows:
- Organization admins to update the organization they belong to
- Super admins to update any organization (existing behavior preserved)

---

## Technical Details

| Aspect | Details |
|--------|---------|
| Root Cause | RLS UPDATE policy on `organizations` restricts to super_admin only |
| Current Behavior | PATCH returns 204 but no rows updated |
| Fix | Add policy allowing org admins to update their organization |
| Impact | Org admins can now update `community_session_id`, timezone, and other org settings |

---

## Files to Modify

| File | Action | Purpose |
|------|--------|---------|
| Database migration | **Create** | Add new RLS policy for org admin updates |

---

## Why the UI Shows Success

The toast shows "Community creation number updated" because:
1. The Supabase client doesn't throw an error on 204 responses
2. The mutation's `onSuccess` callback fires regardless of rows affected
3. The query invalidation happens, but refetches the same (unchanged) data

The fix will ensure the actual database update succeeds, so the refetched data will reflect the new value.

