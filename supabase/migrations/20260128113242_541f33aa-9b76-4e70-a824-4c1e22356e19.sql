-- Phase 1B: Multi-Tenant SaaS Database Foundation
-- Create tables, functions, and add organization_id to business tables

-- Step 1: Create organizations table
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Step 2: Create organization_features table
CREATE TABLE public.organization_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  feature_key text NOT NULL,
  is_enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, feature_key)
);

-- Step 3: Create organization_members table
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  role app_role NOT NULL DEFAULT 'viewer',
  is_org_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Step 4: Enable RLS on new tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Step 5: Create security definer functions
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_organizations(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(organization_id)
  FROM public.organization_members
  WHERE user_id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.user_belongs_to_org(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
  )
$$;

CREATE OR REPLACE FUNCTION public.has_org_feature(_org_id uuid, _feature text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_enabled
     FROM public.organization_features
     WHERE organization_id = _org_id
       AND feature_key = _feature),
    false
  )
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND is_org_admin = true
  )
$$;

-- Step 6: Create default organization for existing data
INSERT INTO public.organizations (id, name, slug, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', 'Nikist', 'nikist', true);

-- Step 7: Add organization_id to all business tables

-- leads table
ALTER TABLE public.leads 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.leads SET organization_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.leads ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.leads ALTER COLUMN organization_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

-- lead_assignments table
ALTER TABLE public.lead_assignments 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.lead_assignments SET organization_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.lead_assignments ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.lead_assignments ALTER COLUMN organization_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

-- call_appointments table
ALTER TABLE public.call_appointments 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.call_appointments SET organization_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.call_appointments ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.call_appointments ALTER COLUMN organization_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

-- batches table
ALTER TABLE public.batches 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.batches SET organization_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.batches ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.batches ALTER COLUMN organization_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

-- futures_mentorship_batches table
ALTER TABLE public.futures_mentorship_batches 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.futures_mentorship_batches SET organization_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.futures_mentorship_batches ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.futures_mentorship_batches ALTER COLUMN organization_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

-- futures_mentorship_students table
ALTER TABLE public.futures_mentorship_students 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.futures_mentorship_students SET organization_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.futures_mentorship_students ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.futures_mentorship_students ALTER COLUMN organization_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

-- high_future_batches table
ALTER TABLE public.high_future_batches 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.high_future_batches SET organization_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.high_future_batches ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.high_future_batches ALTER COLUMN organization_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

-- high_future_students table
ALTER TABLE public.high_future_students 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.high_future_students SET organization_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.high_future_students ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.high_future_students ALTER COLUMN organization_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

-- workshops table
ALTER TABLE public.workshops 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.workshops SET organization_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.workshops ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.workshops ALTER COLUMN organization_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

-- funnels table
ALTER TABLE public.funnels 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.funnels SET organization_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.funnels ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.funnels ALTER COLUMN organization_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

-- products table
ALTER TABLE public.products 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.products SET organization_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.products ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.products ALTER COLUMN organization_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

-- daily_money_flow table
ALTER TABLE public.daily_money_flow 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.daily_money_flow SET organization_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.daily_money_flow ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.daily_money_flow ALTER COLUMN organization_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

-- emi_payments table
ALTER TABLE public.emi_payments 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.emi_payments SET organization_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.emi_payments ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.emi_payments ALTER COLUMN organization_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

-- futures_emi_payments table
ALTER TABLE public.futures_emi_payments 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.futures_emi_payments SET organization_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.futures_emi_payments ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.futures_emi_payments ALTER COLUMN organization_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

-- high_future_emi_payments table
ALTER TABLE public.high_future_emi_payments 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.high_future_emi_payments SET organization_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.high_future_emi_payments ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.high_future_emi_payments ALTER COLUMN organization_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

-- sales table
ALTER TABLE public.sales 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.sales SET organization_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.sales ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.sales ALTER COLUMN organization_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

-- offer_amount_history table
ALTER TABLE public.offer_amount_history 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.offer_amount_history SET organization_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.offer_amount_history ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.offer_amount_history ALTER COLUMN organization_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

-- futures_offer_amount_history table
ALTER TABLE public.futures_offer_amount_history 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.futures_offer_amount_history SET organization_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.futures_offer_amount_history ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.futures_offer_amount_history ALTER COLUMN organization_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

-- high_future_offer_amount_history table
ALTER TABLE public.high_future_offer_amount_history 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.high_future_offer_amount_history SET organization_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.high_future_offer_amount_history ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.high_future_offer_amount_history ALTER COLUMN organization_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

-- call_reminders table
ALTER TABLE public.call_reminders 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.call_reminders SET organization_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.call_reminders ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.call_reminders ALTER COLUMN organization_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

-- customer_onboarding table
ALTER TABLE public.customer_onboarding 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.customer_onboarding SET organization_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.customer_onboarding ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.customer_onboarding ALTER COLUMN organization_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

-- webhook_ingest_events table
ALTER TABLE public.webhook_ingest_events 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.webhook_ingest_events SET organization_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.webhook_ingest_events ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.webhook_ingest_events ALTER COLUMN organization_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

-- Step 8: Migrate existing users to organization_members
INSERT INTO public.organization_members (organization_id, user_id, role, is_org_admin)
SELECT 
  '00000000-0000-0000-0000-000000000001',
  ur.user_id,
  ur.role,
  (ur.role = 'admin')
FROM public.user_roles ur
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Step 9: Create default features for the organization
INSERT INTO public.organization_features (organization_id, feature_key, is_enabled)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'dashboard', true),
  ('00000000-0000-0000-0000-000000000001', 'daily_money_flow', true),
  ('00000000-0000-0000-0000-000000000001', 'customers', true),
  ('00000000-0000-0000-0000-000000000001', 'customer_insights', true),
  ('00000000-0000-0000-0000-000000000001', 'call_schedule', true),
  ('00000000-0000-0000-0000-000000000001', 'sales_closers', true),
  ('00000000-0000-0000-0000-000000000001', 'batch_icc', true),
  ('00000000-0000-0000-0000-000000000001', 'batch_futures', true),
  ('00000000-0000-0000-0000-000000000001', 'batch_high_future', true),
  ('00000000-0000-0000-0000-000000000001', 'workshops', true),
  ('00000000-0000-0000-0000-000000000001', 'sales', true),
  ('00000000-0000-0000-0000-000000000001', 'funnels', true),
  ('00000000-0000-0000-0000-000000000001', 'products', true),
  ('00000000-0000-0000-0000-000000000001', 'users', true),
  ('00000000-0000-0000-0000-000000000001', 'integrations', true);

-- Step 10: Create indexes for performance
CREATE INDEX idx_leads_organization_id ON public.leads(organization_id);
CREATE INDEX idx_lead_assignments_organization_id ON public.lead_assignments(organization_id);
CREATE INDEX idx_call_appointments_organization_id ON public.call_appointments(organization_id);
CREATE INDEX idx_batches_organization_id ON public.batches(organization_id);
CREATE INDEX idx_futures_mentorship_batches_organization_id ON public.futures_mentorship_batches(organization_id);
CREATE INDEX idx_futures_mentorship_students_organization_id ON public.futures_mentorship_students(organization_id);
CREATE INDEX idx_high_future_batches_organization_id ON public.high_future_batches(organization_id);
CREATE INDEX idx_high_future_students_organization_id ON public.high_future_students(organization_id);
CREATE INDEX idx_workshops_organization_id ON public.workshops(organization_id);
CREATE INDEX idx_funnels_organization_id ON public.funnels(organization_id);
CREATE INDEX idx_products_organization_id ON public.products(organization_id);
CREATE INDEX idx_daily_money_flow_organization_id ON public.daily_money_flow(organization_id);
CREATE INDEX idx_emi_payments_organization_id ON public.emi_payments(organization_id);
CREATE INDEX idx_futures_emi_payments_organization_id ON public.futures_emi_payments(organization_id);
CREATE INDEX idx_high_future_emi_payments_organization_id ON public.high_future_emi_payments(organization_id);
CREATE INDEX idx_sales_organization_id ON public.sales(organization_id);
CREATE INDEX idx_organization_members_user_id ON public.organization_members(user_id);
CREATE INDEX idx_organization_members_org_id ON public.organization_members(organization_id);

-- Step 11: RLS Policies for new tables

-- Organizations RLS
CREATE POLICY "Super admins can view all organizations"
  ON public.organizations FOR SELECT
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Users can view their organizations"
  ON public.organizations FOR SELECT
  USING (
    id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Super admins can create organizations"
  ON public.organizations FOR INSERT
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update organizations"
  ON public.organizations FOR UPDATE
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete organizations"
  ON public.organizations FOR DELETE
  USING (is_super_admin(auth.uid()));

-- Organization Features RLS
CREATE POLICY "Super admins can manage all org features"
  ON public.organization_features FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Users can view their org features"
  ON public.organization_features FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  );

-- Organization Members RLS
CREATE POLICY "Super admins can view all org members"
  ON public.organization_members FOR SELECT
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Users can view members of their org"
  ON public.organization_members FOR SELECT
  USING (
    organization_id IN (SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid())
  );

CREATE POLICY "Super admins can manage org members"
  ON public.organization_members FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Org admins can manage their org members"
  ON public.organization_members FOR ALL
  USING (is_org_admin(auth.uid(), organization_id));

-- Step 12: Create updated_at trigger for organizations
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();