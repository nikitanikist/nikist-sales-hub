import { useQuery } from "@tanstack/react-query";
import { useEffect, useCallback, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CallingAgentCall {
  id: string;
  campaign_id: string;
  organization_id: string;
  contact_name: string | null;
  contact_phone: string;
  status: string;
  outcome: string | null;
  bolna_call_id: string | null;
  call_duration_seconds: number;
  total_cost: number;
  transcript: string | null;
  summary: string | null;
  recording_url: string | null;
  extracted_data: any;
  context_details: any;
  call_started_at: string | null;
  call_ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CallingAgentCampaignDetail {
  id: string;
  name: string;
  bolna_agent_name: string | null;
  status: string;
  total_contacts: number;
  calls_completed: number;
  total_cost: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useCallingAgentDetail(campaignId: string | undefined) {
  const { data: campaign, isLoading: campaignLoading, refetch: refetchCampaign } = useQuery({
    queryKey: ["calling-agent-campaign", campaignId],
    queryFn: async () => {
      if (!campaignId) return null;
      const { data, error } = await supabase
        .from("calling_agent_campaigns")
        .select("*")
        .eq("id", campaignId)
        .single();
      if (error) throw error;
      return data as unknown as CallingAgentCampaignDetail;
    },
    enabled: !!campaignId,
  });

  const { data: calls = [], isLoading: callsLoading, refetch: refetchCalls } = useQuery({
    queryKey: ["calling-agent-calls", campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const { data, error } = await supabase
        .from("calling_agent_calls")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as CallingAgentCall[];
    },
    enabled: !!campaignId,
  });

  // Realtime
  const [liveCampaign, setLiveCampaign] = useState<CallingAgentCampaignDetail | null>(null);
  const [liveCalls, setLiveCalls] = useState<Map<string, CallingAgentCall>>(new Map());

  useEffect(() => {
    if (!campaignId) return;

    const channel = supabase
      .channel(`agent-campaign-${campaignId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "calling_agent_campaigns",
        filter: `id=eq.${campaignId}`,
      }, (payload) => {
        setLiveCampaign(payload.new as unknown as CallingAgentCampaignDetail);
      })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "calling_agent_calls",
        filter: `campaign_id=eq.${campaignId}`,
      }, (payload) => {
        const call = payload.new as unknown as CallingAgentCall;
        setLiveCalls((prev) => {
          const next = new Map(prev);
          next.set(call.id, call);
          return next;
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [campaignId]);

  const currentCampaign = useMemo(() => {
    if (!liveCampaign) return campaign;
    if (!campaign) return liveCampaign;
    return new Date(liveCampaign.updated_at) >= new Date(campaign.updated_at)
      ? liveCampaign : campaign;
  }, [liveCampaign, campaign]);

  const mergedCalls = useMemo(() => {
    const map = new Map<string, CallingAgentCall>();
    calls.forEach((c) => map.set(c.id, c));
    liveCalls.forEach((c, id) => map.set(id, c));
    return Array.from(map.values());
  }, [calls, liveCalls]);

  return {
    campaign: currentCampaign,
    calls: mergedCalls,
    isLoading: campaignLoading || callsLoading,
    refetchCalls,
    refetchCampaign,
  };
}
