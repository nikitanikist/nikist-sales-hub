

# Fix: Infinite Recursion in `user_roles` RLS Policy

## Problem
When you log in, the app queries the `user_roles` table to check if you're a super admin. But the RLS policy "Super admins can view all roles" on that table does a sub-query back into `user_roles` to verify super admin status -- creating an infinite loop. Postgres returns error `42P17: infinite recursion detected in policy for relation "user_roles"`.

Since this query fails, the system never recognizes you as a super admin, so:
- The redirect to `/super-admin` never fires
- Manually navigating to `/super-admin` shows "Access denied"

## Root Cause
This RLS policy on `user_roles`:

```text
"Super admins can view all roles"
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
  )
)
```

It references `user_roles` from within its own policy -- classic recursive RLS.

## Solution
1. Create (or verify) a `SECURITY DEFINER` function called `has_role` that directly checks `user_roles` while bypassing RLS.
2. Drop the recursive policy.
3. Replace it with a new policy that calls `has_role(auth.uid(), 'super_admin')` instead of doing a sub-select.

## Technical Details

### Database Migration (single SQL migration)

```sql
-- Step 1: Create the SECURITY DEFINER helper (idempotent)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text = _role
  );
$$;

-- Step 2: Drop the broken policy
DROP POLICY IF EXISTS "Super admins can view all roles" ON public.user_roles;

-- Step 3: Recreate it using the safe function
CREATE POLICY "Super admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
);
```

### No frontend changes needed
The `useUserRole` hook and `AppLayout` redirect logic are already correct. Once the RLS policy stops erroring, the super admin check will succeed and everything will work.

