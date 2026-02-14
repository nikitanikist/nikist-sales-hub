
-- Step 1: Create/update the SECURITY DEFINER helper (idempotent)
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

-- Step 2: Drop the broken recursive policy
DROP POLICY IF EXISTS "Super admins can view all roles" ON public.user_roles;

-- Step 3: Recreate using the safe function
CREATE POLICY "Super admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
);

-- Step 4: Also ensure users can read their own role
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
