import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Hook to check if an organization has reached a specific limit.
 * Returns a function `checkLimit(key, currentCount?)` that shows a toast and returns false if at limit.
 */
export function useLimitCheck(organizationId?: string) {
  const { data: subscription } = useQuery({
    queryKey: ["org-subscription-for-limit", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const { data, error } = await supabase
        .from("organization_subscriptions")
        .select(`
          id, plan_id, custom_limits, status,
          billing_plans!organization_subscriptions_plan_id_fkey (name, slug)
        `)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!organizationId,
  });

  const { data: planLimits } = useQuery({
    queryKey: ["plan-limits-for-check", subscription?.plan_id],
    queryFn: async () => {
      if (!subscription?.plan_id) return [];
      const { data, error } = await supabase
        .from("plan_limits")
        .select("*")
        .eq("plan_id", subscription.plan_id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!subscription?.plan_id,
  });

  const checkLimit = (limitKey: string, currentCount: number): boolean => {
    if (!subscription || !planLimits) return true; // No subscription = no enforcement

    const planLimit = planLimits.find((l: any) => l.limit_key === limitKey);
    if (!planLimit) return true;

    const customLimits = (subscription.custom_limits || {}) as Record<string, number>;
    const effectiveLimit = customLimits[limitKey] ?? planLimit.limit_value;
    const planName = subscription.billing_plans?.name || "your";

    if (currentCount >= effectiveLimit) {
      toast.error(
        `You've reached the limit for ${limitKey.replace(/_/g, " ")} on your ${planName} plan. Please upgrade or contact support.`
      );
      return false;
    }
    return true;
  };

  return { checkLimit, subscription, planLimits };
}
