import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import type { CreateBroadcastData } from "@/types/voice-campaign";
import { toast } from "sonner";

export function useCreateBroadcast() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateBroadcastData) => {
      if (!currentOrganization || !user) throw new Error("Not authenticated");

      // 1. Create campaign
      const { data: campaign, error: campErr } = await supabase
        .from("voice_campaigns")
        .insert({
          organization_id: currentOrganization.id,
          created_by: user.id,
          name: data.name,
          agent_type: "workshop_reminder",
          bolna_agent_id: data.bolna_agent_id || null,
          workshop_id: data.workshop_id || null,
          workshop_name: data.workshop_name || null,
          workshop_time: data.workshop_time || null,
          whatsapp_template_id: data.whatsapp_template_id || null,
          status: data.scheduled_at ? "scheduled" : "draft",
          scheduled_at: data.scheduled_at || null,
          total_contacts: data.contacts.length,
        })
        .select()
        .single();

      if (campErr || !campaign) throw campErr || new Error("Failed to create campaign");

      // 2. Bulk insert calls (batch in chunks of 500)
      const calls = data.contacts.map((c) => ({
        campaign_id: campaign.id,
        organization_id: currentOrganization.id,
        lead_id: c.lead_id || null,
        contact_name: c.name,
        contact_phone: c.phone.startsWith("+91") ? c.phone : c.phone.startsWith("91") ? `+${c.phone}` : `+91${c.phone}`,
        status: "pending" as const,
      }));

      const chunkSize = 500;
      for (let i = 0; i < calls.length; i += chunkSize) {
        const chunk = calls.slice(i, i + chunkSize);
        const { error: insertErr } = await supabase.from("voice_campaign_calls").insert(chunk);
        if (insertErr) throw insertErr;
      }

      // 3. If starting now, invoke edge function
      if (!data.scheduled_at) {
        const { error: fnErr } = await supabase.functions.invoke("start-voice-campaign", {
          body: { campaign_id: campaign.id },
        });
        if (fnErr) {
          console.error("Failed to start campaign:", fnErr);
          toast.error("Campaign created but failed to start. You can retry from the campaign detail page.");
        }
      }

      return campaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voice-campaigns"] });
      toast.success("Calling broadcast created successfully!");
    },
    onError: (error) => {
      toast.error(`Failed to create broadcast: ${error.message}`);
    },
  });
}
