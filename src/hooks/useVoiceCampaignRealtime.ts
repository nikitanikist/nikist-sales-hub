import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { VoiceCampaignCall, VoiceCampaign } from "@/types/voice-campaign";

export function useVoiceCampaignRealtime(
  campaignId: string | undefined,
  onCallUpdate: (call: VoiceCampaignCall) => void,
  onCampaignUpdate: (campaign: VoiceCampaign) => void
) {
  useEffect(() => {
    if (!campaignId) return;

    const channel = supabase
      .channel(`campaign-${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "voice_campaign_calls",
          filter: `campaign_id=eq.${campaignId}`,
        },
        (payload) => {
          if (payload.new) {
            onCallUpdate(payload.new as unknown as VoiceCampaignCall);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "voice_campaigns",
          filter: `id=eq.${campaignId}`,
        },
        (payload) => {
          if (payload.new) {
            onCampaignUpdate(payload.new as unknown as VoiceCampaign);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId, onCallUpdate, onCampaignUpdate]);
}
