import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { IvrCampaign, IvrCampaignCall } from "@/types/ivr-campaign";

export function useIvrCampaignDetail(campaignId: string | undefined) {
  const campaignQuery = useQuery({
    queryKey: ["ivr-campaign", campaignId],
    queryFn: async () => {
      if (!campaignId) return null;
      const { data, error } = await supabase
        .from("ivr_campaigns")
        .select("*")
        .eq("id", campaignId)
        .single();
      if (error) throw error;
      return data as unknown as IvrCampaign;
    },
    enabled: !!campaignId,
  });

  const callsQuery = useQuery({
    queryKey: ["ivr-campaign-calls", campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const { data, error } = await supabase
        .from("ivr_campaign_calls")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as IvrCampaignCall[];
    },
    enabled: !!campaignId,
  });

  return {
    campaign: campaignQuery.data,
    calls: callsQuery.data || [],
    isLoading: campaignQuery.isLoading || callsQuery.isLoading,
    refetchCalls: callsQuery.refetch,
    refetchCampaign: campaignQuery.refetch,
  };
}
