-- Add new columns to leads table for Pabbly integration
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS workshop_name TEXT,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'tagmango';

-- Make created_by nullable for external API leads
ALTER TABLE public.leads 
ALTER COLUMN created_by DROP NOT NULL;

-- Update INSERT policy to allow service role insertions
DROP POLICY IF EXISTS "Sales reps and admins can create leads" ON public.leads;

CREATE POLICY "Sales reps and admins can create leads" 
ON public.leads 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'sales_rep'::app_role)
  OR auth.uid() IS NULL  -- Allow service role insertions
);