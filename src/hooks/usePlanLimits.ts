import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlanLimit {
  id: string;
  plan_id: string;
  limit_key: string;
  limit_value: number;
  description: string | null;
}

export function usePlanLimits(planId?: string) {
  return useQuery({
    queryKey: ["plan-limits", planId],
    queryFn: async () => {
      if (!planId) return [];
      const { data, error } = await supabase
        .from("plan_limits")
        .select("*")
        .eq("plan_id", planId);
      if (error) throw error;
      return (data || []) as PlanLimit[];
    },
    enabled: !!planId,
  });
}

export function useAllPlanLimits() {
  return useQuery({
    queryKey: ["all-plan-limits"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plan_limits").select("*");
      if (error) throw error;
      return (data || []) as PlanLimit[];
    },
  });
}

/**
 * Get effective limits for an org, merging plan limits with custom overrides
 */
export function getEffectiveLimits(
  planLimits: PlanLimit[],
  customLimits: Record<string, number> = {}
): Record<string, number> {
  const limits: Record<string, number> = {};
  for (const pl of planLimits) {
    limits[pl.limit_key] = customLimits[pl.limit_key] ?? pl.limit_value;
  }
  return limits;
}
