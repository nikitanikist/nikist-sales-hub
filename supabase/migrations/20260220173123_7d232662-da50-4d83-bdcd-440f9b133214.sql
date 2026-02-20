
-- =============================================
-- Phase 1: Subscription & Billing System
-- =============================================

-- 1. billing_plans
CREATE TABLE public.billing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  monthly_price NUMERIC NOT NULL DEFAULT 0,
  yearly_price NUMERIC NOT NULL DEFAULT 0,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. plan_limits
CREATE TABLE public.plan_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.billing_plans(id) ON DELETE CASCADE,
  limit_key TEXT NOT NULL,
  limit_value INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  UNIQUE(plan_id, limit_key)
);

-- 3. plan_features
CREATE TABLE public.plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.billing_plans(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  feature_value TEXT NOT NULL DEFAULT 'false',
  description TEXT,
  UNIQUE(plan_id, feature_key)
);

-- 4. organization_subscriptions
CREATE TABLE public.organization_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
  plan_id UUID NOT NULL REFERENCES public.billing_plans(id),
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial','active','past_due','cancelled','expired')),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','yearly')),
  current_price NUMERIC,
  custom_price NUMERIC,
  subscription_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  next_payment_due TIMESTAMPTZ,
  trial_started_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  setup_fee NUMERIC DEFAULT 0,
  setup_fee_paid BOOLEAN DEFAULT false,
  custom_limits JSONB DEFAULT '{}'::jsonb,
  admin_notes TEXT,
  cancelled_reason TEXT,
  upgrade_from_plan_id UUID REFERENCES public.billing_plans(id),
  downgrade_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. subscription_payments
CREATE TABLE public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.organization_subscriptions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('setup_fee','subscription','addon','refund')),
  payment_method TEXT CHECK (payment_method IN ('manual','bank_transfer','upi','cash','other')),
  payment_status TEXT NOT NULL DEFAULT 'completed' CHECK (payment_status IN ('pending','completed','failed','refunded')),
  payment_reference TEXT,
  payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  recorded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. organization_usage
CREATE TABLE public.organization_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  usage_key TEXT NOT NULL,
  usage_value INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, period_start, usage_key)
);

-- 7. subscription_audit_log
CREATE TABLE public.subscription_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES public.organization_subscriptions(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  performed_by UUID REFERENCES public.profiles(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. subscription_notifications
CREATE TABLE public.subscription_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  read_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- Indexes
-- =============================================
CREATE INDEX idx_plan_limits_plan ON public.plan_limits(plan_id);
CREATE INDEX idx_plan_features_plan ON public.plan_features(plan_id);
CREATE INDEX idx_org_subscriptions_org ON public.organization_subscriptions(organization_id);
CREATE INDEX idx_org_subscriptions_status ON public.organization_subscriptions(status);
CREATE INDEX idx_subscription_payments_sub ON public.subscription_payments(subscription_id);
CREATE INDEX idx_subscription_payments_org ON public.subscription_payments(organization_id);
CREATE INDEX idx_org_usage_org ON public.organization_usage(organization_id);
CREATE INDEX idx_audit_log_sub ON public.subscription_audit_log(subscription_id);
CREATE INDEX idx_sub_notifications_org ON public.subscription_notifications(organization_id);
CREATE INDEX idx_sub_notifications_unread ON public.subscription_notifications(is_read) WHERE is_read = false;

-- =============================================
-- Updated_at triggers
-- =============================================
CREATE TRIGGER update_billing_plans_updated_at BEFORE UPDATE ON public.billing_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_org_subscriptions_updated_at BEFORE UPDATE ON public.organization_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_org_usage_updated_at BEFORE UPDATE ON public.organization_usage FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- RLS
-- =============================================
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_notifications ENABLE ROW LEVEL SECURITY;

-- Plans/limits/features: readable by all authenticated, manageable by super admins
CREATE POLICY "Anyone can read billing plans" ON public.billing_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins manage billing plans" ON public.billing_plans FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Anyone can read plan limits" ON public.plan_limits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins manage plan limits" ON public.plan_limits FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Anyone can read plan features" ON public.plan_features FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins manage plan features" ON public.plan_features FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- Subscriptions: org members can view own, super admins full access
CREATE POLICY "Org members view own subscription" ON public.organization_subscriptions FOR SELECT TO authenticated USING (organization_id = ANY(public.get_user_organization_ids()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins manage subscriptions" ON public.organization_subscriptions FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- Payments: org members view own, super admins full access
CREATE POLICY "Org members view own payments" ON public.subscription_payments FOR SELECT TO authenticated USING (organization_id = ANY(public.get_user_organization_ids()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins manage payments" ON public.subscription_payments FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- Usage: org members view own, super admins full access
CREATE POLICY "Org members view own usage" ON public.organization_usage FOR SELECT TO authenticated USING (organization_id = ANY(public.get_user_organization_ids()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins manage usage" ON public.organization_usage FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- Audit log: org members view via subscription, super admins full access
CREATE POLICY "Super admins view audit log" ON public.subscription_audit_log FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins manage audit log" ON public.subscription_audit_log FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- Notifications: super admins full access
CREATE POLICY "Super admins view notifications" ON public.subscription_notifications FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins manage notifications" ON public.subscription_notifications FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- =============================================
-- Seed Data: 4 Billing Plans
-- =============================================
INSERT INTO public.billing_plans (name, slug, description, monthly_price, yearly_price, is_custom, display_order) VALUES
  ('Starter', 'starter', 'Essential tools to get started with WhatsApp CRM', 35, 350, false, 1),
  ('Growth', 'growth', 'Scale your operations with more capacity', 35, 350, false, 2),
  ('Pro', 'pro', 'Advanced features for power users', 49, 490, false, 3),
  ('Enterprise', 'enterprise', 'Custom solution for large organizations', 0, 0, true, 4);

-- Plan Limits
INSERT INTO public.plan_limits (plan_id, limit_key, limit_value, description)
SELECT bp.id, v.limit_key, v.limit_value, v.description
FROM public.billing_plans bp
CROSS JOIN (VALUES
  ('starter', 'whatsapp_numbers', 1, 'Connected WhatsApp numbers'),
  ('starter', 'team_members', 3, 'Team members'),
  ('starter', 'groups_synced', 10, 'WhatsApp groups synced'),
  ('starter', 'campaigns_per_month', 10, 'Campaigns per month'),
  ('starter', 'recipients_per_campaign', 500, 'Recipients per campaign'),
  ('starter', 'dynamic_links', 5, 'Dynamic links'),
  ('growth', 'whatsapp_numbers', 2, 'Connected WhatsApp numbers'),
  ('growth', 'team_members', 10, 'Team members'),
  ('growth', 'groups_synced', 50, 'WhatsApp groups synced'),
  ('growth', 'campaigns_per_month', 30, 'Campaigns per month'),
  ('growth', 'recipients_per_campaign', 2000, 'Recipients per campaign'),
  ('growth', 'dynamic_links', 20, 'Dynamic links'),
  ('pro', 'whatsapp_numbers', 5, 'Connected WhatsApp numbers'),
  ('pro', 'team_members', 25, 'Team members'),
  ('pro', 'groups_synced', 200, 'WhatsApp groups synced'),
  ('pro', 'campaigns_per_month', 100, 'Campaigns per month'),
  ('pro', 'recipients_per_campaign', 10000, 'Recipients per campaign'),
  ('pro', 'dynamic_links', 100, 'Dynamic links'),
  ('enterprise', 'whatsapp_numbers', 9999, 'Connected WhatsApp numbers'),
  ('enterprise', 'team_members', 9999, 'Team members'),
  ('enterprise', 'groups_synced', 9999, 'WhatsApp groups synced'),
  ('enterprise', 'campaigns_per_month', 9999, 'Campaigns per month'),
  ('enterprise', 'recipients_per_campaign', 99999, 'Recipients per campaign'),
  ('enterprise', 'dynamic_links', 9999, 'Dynamic links')
) AS v(plan_slug, limit_key, limit_value, description)
WHERE bp.slug = v.plan_slug;

-- Plan Features
INSERT INTO public.plan_features (plan_id, feature_key, feature_value, description)
SELECT bp.id, v.feature_key, v.feature_value, v.description
FROM public.billing_plans bp
CROSS JOIN (VALUES
  ('starter', 'analytics', 'basic', 'Analytics level'),
  ('starter', 'community_creation', 'false', 'Community creation'),
  ('starter', 'data_export', 'false', 'Data export'),
  ('starter', 'support_channel', 'email', 'Support channel'),
  ('starter', 'onboarding_minutes', '0', 'Onboarding minutes'),
  ('starter', 'custom_branding', 'false', 'Custom branding'),
  ('growth', 'analytics', 'standard', 'Analytics level'),
  ('growth', 'community_creation', 'true', 'Community creation'),
  ('growth', 'data_export', 'true', 'Data export'),
  ('growth', 'support_channel', 'chat', 'Support channel'),
  ('growth', 'onboarding_minutes', '30', 'Onboarding minutes'),
  ('growth', 'custom_branding', 'false', 'Custom branding'),
  ('pro', 'analytics', 'advanced', 'Analytics level'),
  ('pro', 'community_creation', 'true', 'Community creation'),
  ('pro', 'data_export', 'true', 'Data export'),
  ('pro', 'support_channel', 'priority', 'Support channel'),
  ('pro', 'onboarding_minutes', '60', 'Onboarding minutes'),
  ('pro', 'custom_branding', 'true', 'Custom branding'),
  ('enterprise', 'analytics', 'advanced', 'Analytics level'),
  ('enterprise', 'community_creation', 'true', 'Community creation'),
  ('enterprise', 'data_export', 'true', 'Data export'),
  ('enterprise', 'support_channel', 'dedicated', 'Support channel'),
  ('enterprise', 'onboarding_minutes', '120', 'Onboarding minutes'),
  ('enterprise', 'custom_branding', 'true', 'Custom branding')
) AS v(plan_slug, feature_key, feature_value, description)
WHERE bp.slug = v.plan_slug;

-- =============================================
-- Nikist Organization Migration
-- =============================================
INSERT INTO public.organization_subscriptions (
  organization_id, plan_id, status, billing_cycle,
  current_price, subscription_started_at,
  current_period_start, current_period_end, next_payment_due
)
SELECT
  o.id,
  bp.id,
  'active',
  'monthly',
  bp.monthly_price,
  o.created_at,
  date_trunc('month', now()),
  date_trunc('month', now()) + interval '1 month',
  date_trunc('month', now()) + interval '1 month'
FROM public.organizations o
CROSS JOIN public.billing_plans bp
WHERE o.name = 'Nikist' AND bp.slug = 'pro'
LIMIT 1;

-- Audit log entry for Nikist migration
INSERT INTO public.subscription_audit_log (subscription_id, action, new_value)
SELECT
  os.id,
  'created',
  jsonb_build_object('note', 'Migrated existing organization to Pro plan', 'plan', 'pro', 'status', 'active')
FROM public.organization_subscriptions os
JOIN public.organizations o ON o.id = os.organization_id
WHERE o.name = 'Nikist'
LIMIT 1;
