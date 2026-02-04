
-- Fix 1: Add search_path to update_updated_at_column function to prevent search path attacks
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix 2: Move pg_net extension from public to extensions schema
-- First create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant usage on extensions schema to appropriate roles
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Drop the existing pg_net extension from public and recreate in extensions
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION pg_net WITH SCHEMA extensions;

-- Fix 3: Tighten RLS policy on webhook_ingest_events - restrict inserts to service role pattern
-- The webhook edge function uses service role, so we don't need public INSERT access
DROP POLICY IF EXISTS "Anyone can insert webhook events" ON public.webhook_ingest_events;

-- Allow inserts only from authenticated users (edge functions use service role which bypasses RLS)
-- This is safe because edge functions use service_role key and skip RLS anyway
CREATE POLICY "Service role can insert webhook events"
ON public.webhook_ingest_events
FOR INSERT
WITH CHECK (false);
-- Note: WITH CHECK (false) blocks direct client inserts but service role bypasses RLS

-- Fix 4: Remove the overly permissive policy on user_roles (the safer "Users can view their own roles" already exists)
DROP POLICY IF EXISTS "Authenticated users can view all roles" ON public.user_roles;

-- Add policy for super admins to view all roles
CREATE POLICY "Super admins can view all roles"
ON public.user_roles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
  )
);
