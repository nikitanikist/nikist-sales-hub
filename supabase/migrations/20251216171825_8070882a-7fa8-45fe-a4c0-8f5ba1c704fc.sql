-- Create customer_onboarding table for storing onboarding form responses
CREATE TABLE public.customer_onboarding (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  
  -- Section 1: Personal Information
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  gender TEXT,
  age_group TEXT,
  date_of_birth DATE,
  marital_status TEXT,
  
  -- Section 2: Location
  country TEXT,
  state TEXT,
  city TEXT,
  area_type TEXT,
  
  -- Section 3: Occupation (with conditional fields)
  occupation TEXT,
  -- Salaried fields
  industry TEXT,
  job_title TEXT,
  years_experience TEXT,
  company_size TEXT,
  -- Business owner fields
  business_type TEXT,
  business_years TEXT,
  team_size TEXT,
  annual_revenue TEXT,
  -- Student fields
  education_level TEXT,
  field_of_study TEXT,
  
  -- Section 4: Financial Information
  monthly_income TEXT,
  income_source TEXT,
  dependents TEXT,
  
  -- Section 5: Preferences & Interests
  referral_source TEXT,
  primary_goal TEXT,
  preferred_communication TEXT,
  preferred_contact_time TEXT,
  interests TEXT[],
  monthly_budget TEXT,
  decision_factors TEXT[],
  
  -- Section 6: Consent
  marketing_consent BOOLEAN DEFAULT false,
  terms_accepted BOOLEAN DEFAULT false,
  
  -- Progress tracking
  current_step INTEGER DEFAULT 1,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.customer_onboarding ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view all onboarding records" 
ON public.customer_onboarding 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Sales reps and admins can create onboarding records" 
ON public.customer_onboarding 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales_rep'::app_role));

CREATE POLICY "Sales reps and admins can update onboarding records" 
ON public.customer_onboarding 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales_rep'::app_role));

CREATE POLICY "Only admins can delete onboarding records" 
ON public.customer_onboarding 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for auto-updating updated_at
CREATE TRIGGER update_customer_onboarding_updated_at
BEFORE UPDATE ON public.customer_onboarding
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();