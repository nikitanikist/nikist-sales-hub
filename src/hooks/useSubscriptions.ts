import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SubscriptionWithPlan {
  id: string;
  organization_id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  current_price: number | null;
  custom_price: number | null;
  subscription_started_at: string;
  current_period_start: string;
  current_period_end: string;
  next_payment_due: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  setup_fee: number | null;
  setup_fee_paid: boolean | null;
  custom_limits: Record<string, number>;
  admin_notes: string | null;
  cancelled_reason: string | null;
  upgrade_from_plan_id: string | null;
  downgrade_date: string | null;
  created_at: string;
  updated_at: string;
  billing_plans: {
    id: string;
    name: string;
    slug: string;
    monthly_price: number;
    yearly_price: number;
    is_custom: boolean;
  };
  organizations: {
    id: string;
    name: string;
    slug: string;
    is_active: boolean;
    created_at: string;
  };
}

export interface BillingPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  monthly_price: number;
  yearly_price: number;
  is_custom: boolean;
  is_active: boolean;
  display_order: number;
}

export function useSubscriptions() {
  const subscriptionsQuery = useQuery({
    queryKey: ["subscriptions-with-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_subscriptions")
        .select(`
          *,
          billing_plans!organization_subscriptions_plan_id_fkey (id, name, slug, monthly_price, yearly_price, is_custom),
          organizations!organization_subscriptions_organization_id_fkey (id, name, slug, is_active, created_at)
        `);
      if (error) throw error;
      return (data || []) as unknown as SubscriptionWithPlan[];
    },
  });

  const plansQuery = useQuery({
    queryKey: ["billing-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_plans")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return (data || []) as BillingPlan[];
    },
  });

  const subscriptions = subscriptionsQuery.data || [];

  // Calculate MRR
  const mrr = subscriptions
    .filter((s) => s.status === "active" || s.status === "trial")
    .reduce((sum, s) => {
      const price = s.custom_price ?? s.current_price ?? 0;
      if (s.billing_cycle === "yearly") return sum + price / 12;
      return sum + price;
    }, 0);

  // Plan distribution
  const planDistribution = (plansQuery.data || []).map((plan) => ({
    name: plan.name,
    count: subscriptions.filter((s) => s.plan_id === plan.id).length,
  }));

  // Upcoming renewals (within 14 days)
  const now = new Date();
  const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const upcomingRenewals = subscriptions.filter((s) => {
    if (s.status !== "active") return false;
    const end = new Date(s.current_period_end);
    return end >= now && end <= in14Days;
  });

  // Expiring trials (within 7 days)
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const expiringTrials = subscriptions.filter((s) => {
    if (s.status !== "trial" || !s.trial_ends_at) return false;
    const end = new Date(s.trial_ends_at);
    return end >= now && end <= in7Days;
  });

  // Counts by status
  const paidCount = subscriptions.filter((s) => s.status === "active").length;
  const trialCount = subscriptions.filter((s) => s.status === "trial").length;
  const inactiveCount = subscriptions.filter(
    (s) => s.status === "expired" || s.status === "cancelled"
  ).length;
  const pastDueCount = subscriptions.filter((s) => s.status === "past_due").length;

  return {
    subscriptions,
    plans: plansQuery.data || [],
    isLoading: subscriptionsQuery.isLoading || plansQuery.isLoading,
    error: subscriptionsQuery.error || plansQuery.error,
    mrr,
    planDistribution,
    upcomingRenewals,
    expiringTrials,
    paidCount,
    trialCount,
    inactiveCount,
    pastDueCount,
    refetch: () => {
      subscriptionsQuery.refetch();
      plansQuery.refetch();
    },
  };
}
