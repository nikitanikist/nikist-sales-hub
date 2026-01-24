-- Create user_permissions table for granular menu access control
CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  permission_key TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, permission_key)
);

-- Enable Row-Level Security
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Users can read their own permissions
CREATE POLICY "Users can view own permissions" 
ON public.user_permissions
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all permissions
CREATE POLICY "Admins can view all permissions"
ON public.user_permissions
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Admins can insert permissions
CREATE POLICY "Admins can insert permissions"
ON public.user_permissions
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Admins can update permissions
CREATE POLICY "Admins can update permissions"
ON public.user_permissions
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Admins can delete permissions
CREATE POLICY "Admins can delete permissions"
ON public.user_permissions
FOR DELETE
USING (has_role(auth.uid(), 'admin'));