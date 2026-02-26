import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { VoiceCampaign, VoiceCampaignCall } from "@/types/voice-campaign";

export function useVoiceCampaignDetail(campaignId: string | undefined) {
  const campaignQuery = useQuery({
    queryKey: ["voice-campaign", campaignId],
    queryFn: async () => {
      if (!campaignId) return null;
      const { data, error } = await supabase
        .from("voice_campaigns")
        .select("*")
        .eq("id", campaignId)
        .single();
      if (error) throw error;
      return data as unknown as VoiceCampaign;
    },
    enabled: !!campaignId,
  });

  const callsQuery = useQuery({
    queryKey: ["voice-campaign-calls", campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const { data, error } = await supabase
        .from("voice_campaign_calls")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as VoiceCampaignCall[];
    },
    enabled: !!campaignId,
  });

  return { campaign: campaignQuery.data, calls: callsQuery.data || [], isLoading: campaignQuery.isLoading || callsQuery.isLoading, refetchCalls: callsQuery.refetch, refetchCampaign: campaignQuery.refetch };
}
