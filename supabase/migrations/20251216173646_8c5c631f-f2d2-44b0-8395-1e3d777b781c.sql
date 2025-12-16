-- Create Customer Insights funnel
INSERT INTO public.funnels (funnel_name, amount, is_free, total_leads)
VALUES ('Customer Insights', 0, true, 0);

-- Create Customer Insights product linked to the funnel
INSERT INTO public.products (product_name, price, funnel_id, is_active, description)
SELECT 'Customer Insights', 0, f.id, true, 'Form submissions from Customer Insights onboarding'
FROM public.funnels f WHERE f.funnel_name = 'Customer Insights';

-- Update RLS policy for leads to allow anonymous INSERT
DROP POLICY IF EXISTS "Sales reps and admins can create leads" ON public.leads;
CREATE POLICY "Sales reps and admins can create leads" 
ON public.leads 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'sales_rep'::app_role) 
  OR (auth.uid() IS NULL)
);

-- Update RLS policy for customer_onboarding to allow anonymous INSERT
DROP POLICY IF EXISTS "Sales reps and admins can create onboarding records" ON public.customer_onboarding;
CREATE POLICY "Anyone can create onboarding records" 
ON public.customer_onboarding 
FOR INSERT 
WITH CHECK (true);

-- Update RLS policy for lead_assignments to allow anonymous INSERT
DROP POLICY IF EXISTS "Sales reps and admins can create assignments" ON public.lead_assignments;
CREATE POLICY "Anyone can create assignments" 
ON public.lead_assignments 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'sales_rep'::app_role) 
  OR (auth.uid() IS NULL)
);