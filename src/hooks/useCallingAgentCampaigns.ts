import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

export interface CallingAgentCampaign {
  id: string;
  organization_id: string;
  created_by: string | null;
  name: string;
  bolna_agent_id: string;
  bolna_agent_name: string | null;
  bolna_batch_id: string | null;
  status: string;
  scheduled_at: string | null;
  total_contacts: number;
  calls_completed: number;
  total_cost: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useCallingAgentCampaigns() {
  const { currentOrganization } = useOrganization();

  const { data: campaigns = [], isLoading, refetch } = useQuery({
    queryKey: ["calling-agent-campaigns", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      const { data, error } = await supabase
        .from("calling_agent_campaigns")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as CallingAgentCampaign[];
    },
    enabled: !!currentOrganization,
  });

  const stats = {
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter((c) => c.status === "running").length,
    completedCampaigns: campaigns.filter((c) => c.status === "completed").length,
    totalCalls: campaigns.reduce((s, c) => s + c.total_contacts, 0),
    totalCost: campaigns.reduce((s, c) => s + c.total_cost, 0),
  };

  return { campaigns, isLoading, refetch, stats };
}
