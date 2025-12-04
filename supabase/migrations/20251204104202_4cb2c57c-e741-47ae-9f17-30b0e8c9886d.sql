-- Allow authenticated users to view all user roles (needed for Sales Closers page)
CREATE POLICY "Authenticated users can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);