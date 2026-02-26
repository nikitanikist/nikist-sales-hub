import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import type { VoiceCampaign } from "@/types/voice-campaign";

export function useVoiceCampaigns(statusFilter?: string) {
  const { currentOrganization } = useOrganization();

  return useQuery({
    queryKey: ["voice-campaigns", currentOrganization?.id, statusFilter],
    queryFn: async () => {
      if (!currentOrganization) return [];
      
      let query = supabase
        .from("voice_campaigns")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as VoiceCampaign[];
    },
    enabled: !!currentOrganization,
  });
}
