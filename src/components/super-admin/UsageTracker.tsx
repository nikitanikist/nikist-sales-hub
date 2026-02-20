import { useOrganizationUsage } from "@/hooks/useOrganizationUsage";
import { usePlanLimits, getEffectiveLimits } from "@/hooks/usePlanLimits";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface UsageTrackerProps {
  organizationId: string;
}

const LIMIT_LABELS: Record<string, string> = {
  team_members: "Team Members",
  whatsapp_numbers: "WhatsApp Numbers",
  groups_synced: "Groups Synced",
  campaigns_per_month: "Campaigns This Month",
  dynamic_links: "Dynamic Links",
};

const UsageTracker = ({ organizationId }: UsageTrackerProps) => {
  const { data: usage, isLoading: usageLoading } = useOrganizationUsage(organizationId);

  // Get subscription to find plan_id and custom_limits
  const { data: subscription } = useQuery({
    queryKey: ["org-sub-usage", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_subscriptions")
        .select("plan_id, custom_limits, billing_plans!organization_subscriptions_plan_id_fkey (name)")
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!organizationId,
  });

  const { data: planLimits = [] } = usePlanLimits(subscription?.plan_id);
  const effectiveLimits = getEffectiveLimits(planLimits, (subscription?.custom_limits || {}) as Record<string, number>);

  if (usageLoading) {
    return <div className="space-y-4"><div className="skeleton-shimmer h-40 rounded" /></div>;
  }

  if (!subscription) {
    return <p className="text-sm text-muted-foreground text-center py-8">No subscription found. Assign a plan first.</p>;
  }

  const usageMap: Record<string, number> = {
    team_members: usage?.teamMembers || 0,
    whatsapp_numbers: usage?.integrations || 0,
    groups_synced: usage?.groups || 0,
    campaigns_per_month: usage?.campaigns || 0,
    dynamic_links: usage?.dynamicLinks || 0,
  };

  const items = Object.entries(LIMIT_LABELS).map(([key, label]) => {
    const current = usageMap[key] || 0;
    const limit = effectiveLimits[key] || 0;
    const pct = limit > 0 ? Math.min((current / limit) * 100, 100) : 0;
    return { key, label, current, limit, pct };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">
          Usage — {(subscription.billing_plans as any)?.name || "Unknown"} Plan
        </h3>
        <Badge variant="outline">{format(new Date(), "MMMM yyyy")}</Badge>
      </div>

      <div className="space-y-5">
        {items.map((item) => (
          <div key={item.key} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{item.label}</span>
              <span className="text-muted-foreground data-text">
                {item.current} / {item.limit >= 9999 ? "∞" : item.limit}
              </span>
            </div>
            <Progress
              value={item.pct}
              className={`h-2 ${
                item.pct >= 100
                  ? "[&>div]:bg-destructive"
                  : item.pct >= 80
                  ? "[&>div]:bg-warning"
                  : ""
              }`}
            />
            {item.pct >= 80 && item.pct < 100 && (
              <p className="text-xs text-warning">Approaching limit</p>
            )}
            {item.pct >= 100 && (
              <p className="text-xs text-destructive">Limit reached</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default UsageTracker;
