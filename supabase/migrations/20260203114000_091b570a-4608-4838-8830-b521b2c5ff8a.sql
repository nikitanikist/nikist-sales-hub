-- Add community_admin_numbers column to organizations table
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS community_admin_numbers text[] DEFAULT '{}';