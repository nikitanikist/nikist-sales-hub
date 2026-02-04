-- Remove overly permissive public SELECT policy on dynamic_links
-- The link-redirect edge function uses service role key so it doesn't need public RLS access
DROP POLICY IF EXISTS "Public can read active links by slug" ON public.dynamic_links;

-- Restrict modules table read access to authenticated users only
DROP POLICY IF EXISTS "Anyone can view modules" ON public.modules;

CREATE POLICY "Authenticated users can view modules" 
ON public.modules 
FOR SELECT 
USING (auth.uid() IS NOT NULL);