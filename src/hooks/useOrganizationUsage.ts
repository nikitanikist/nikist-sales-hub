import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UsageMetric {
  key: string;
  label: string;
  current: number;
  limit: number;
  percentage: number;
}

export function useOrganizationUsage(organizationId?: string) {
  return useQuery({
    queryKey: ["org-usage", organizationId],
    queryFn: async () => {
      if (!organizationId) return { teamMembers: 0, groups: 0, campaigns: 0, integrations: 0, dynamicLinks: 0 };

      // Fetch counts in parallel
      const membersRes = await supabase
        .from("organization_members")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId);

      const groupsRes = await supabase
        .from("whatsapp_groups")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId);

      const campaignsRes = await supabase
        .from("notification_campaigns")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

      const integrationsRes: { count: number | null } = await supabase
        .from("organization_integrations")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId) as any;

      const linksRes = await supabase
        .from("dynamic_links")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId);

      return {
        teamMembers: membersRes.count || 0,
        groups: groupsRes.count || 0,
        campaigns: campaignsRes.count || 0,
        integrations: integrationsRes.count || 0,
        dynamicLinks: linksRes.count || 0,
      };
    },
    enabled: !!organizationId,
  });
}
