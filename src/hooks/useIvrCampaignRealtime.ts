import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { IvrCampaignCall, IvrCampaign } from "@/types/ivr-campaign";

export function useIvrCampaignRealtime(
  campaignId: string | undefined,
  onCallUpdate: (call: IvrCampaignCall) => void,
  onCampaignUpdate: (campaign: IvrCampaign) => void
) {
  useEffect(() => {
    if (!campaignId) return;

    const channel = supabase
      .channel(`ivr-campaign-${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ivr_campaign_calls",
          filter: `campaign_id=eq.${campaignId}`,
        },
        (payload) => {
          if (payload.new) {
            onCallUpdate(payload.new as unknown as IvrCampaignCall);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ivr_campaigns",
          filter: `id=eq.${campaignId}`,
        },
        (payload) => {
          if (payload.new) {
            onCampaignUpdate(payload.new as unknown as IvrCampaign);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId, onCallUpdate, onCampaignUpdate]);
}
