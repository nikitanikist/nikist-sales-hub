import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import type { IvrCampaign } from "@/types/ivr-campaign";

export function useIvrCampaigns(statusFilter?: string) {
  const { currentOrganization } = useOrganization();

  return useQuery({
    queryKey: ["ivr-campaigns", currentOrganization?.id, statusFilter],
    queryFn: async () => {
      if (!currentOrganization) return [];

      let query = supabase
        .from("ivr_campaigns")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as IvrCampaign[];
    },
    enabled: !!currentOrganization,
  });
}
