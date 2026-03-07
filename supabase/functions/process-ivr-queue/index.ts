import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchWithRetry } from "../_shared/fetchWithRetry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find running campaigns
    const { data: campaigns, error: campaignsError } = await supabase
      .from("ivr_campaigns")
      .select("id, organization_id, vobiz_from_number, calls_per_second, concurrent_limit")
      .eq("status", "running");

    if (campaignsError || !campaigns?.length) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalProcessed = 0;

    for (const campaign of campaigns) {
      try {
        // Get VoBiz credentials from organization_integrations
        const { data: vobizIntegration } = await supabase
          .from("organization_integrations")
          .select("config")
          .eq("organization_id", campaign.organization_id)
          .eq("integration_type", "vobiz")
          .eq("is_active", true)
          .limit(1)
          .single();

        if (!vobizIntegration?.config) {
          console.error(`process-ivr-queue: No VoBiz integration for org ${campaign.organization_id}`);
          continue;
        }

        const vobizConfig = vobizIntegration.config as { auth_id: string; auth_token: string; from_number?: string };
        const authId = vobizConfig.auth_id;
        const authToken = vobizConfig.auth_token;

        if (!authId || !authToken) {
          console.error(`process-ivr-queue: Missing VoBiz auth_id or auth_token for org ${campaign.organization_id}`);
          continue;
        }

        // Check currently active (initiated/answered) calls vs concurrent limit
        const { count: activeCalls } = await supabase
          .from("ivr_campaign_calls")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", campaign.id)
          .in("status", ["initiated", "answered"]);

        const concurrentLimit = campaign.concurrent_limit || 10;
        const availableSlots = Math.max(0, concurrentLimit - (activeCalls || 0));

        if (availableSlots === 0) {
          console.log(`process-ivr-queue: campaign ${campaign.id} at concurrent limit (${activeCalls}/${concurrentLimit})`);
          continue;
        }

        // Pick queued calls (including retries that are due)
        const batchSize = Math.min(availableSlots, campaign.calls_per_second || 5);

        const { data: calls } = await supabase
          .from("ivr_campaign_calls")
          .select("id, contact_phone, contact_name")
          .eq("campaign_id", campaign.id)
          .eq("status", "queued")
          .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
          .order("created_at", { ascending: true })
          .limit(batchSize);

        if (!calls?.length) continue;

        const cpsDelay = 1000 / (campaign.calls_per_second || 5);
        const fromNumber = campaign.vobiz_from_number || vobizConfig.from_number || "";

        for (let i = 0; i < calls.length; i++) {
          const call = calls[i];

          try {
            // Format phone
            let phone = call.contact_phone.replace(/\D/g, "");
            if (phone.startsWith("0")) phone = "91" + phone.substring(1);
            if (!phone.startsWith("91") && phone.length === 10) phone = "91" + phone;

            const answerUrl = `${supabaseUrl}/functions/v1/ivr-call-answer?call_id=${call.id}`;
            const hangupUrl = `${supabaseUrl}/functions/v1/ivr-call-hangup?call_id=${call.id}`;

            console.log(`process-ivr-queue: calling ${phone} for call ${call.id}`);

            const vobizResponse = await fetchWithRetry(
              `https://api.vobiz.ai/api/v1/Account/${authId}/Call/`,
              {
                method: "POST",
                headers: {
                  "X-Auth-ID": authId,
                  "X-Auth-Token": authToken,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  from: fromNumber,
                  to: phone,
                  answer_url: answerUrl,
                  answer_method: "POST",
                  hangup_url: hangupUrl,
                  hangup_method: "POST",
                  ring_timeout: 30,
                }),
              },
              { timeoutMs: 15000, maxRetries: 1 }
            );

            const result = await vobizResponse.json().catch(() => ({}));
            console.log(`process-ivr-queue: VoBiz response for call ${call.id}: ${vobizResponse.status}`, JSON.stringify(result).substring(0, 300));

            if (vobizResponse.ok) {
              await supabase.from("ivr_campaign_calls").update({
                status: "initiated",
                vobiz_call_uuid: result.request_uuid || result.RequestUUID || result.call_uuid || null,
                initiated_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }).eq("id", call.id);

              await supabase.rpc("increment_ivr_campaign_counter", {
                p_campaign_id: campaign.id,
                p_counter_name: "calls_initiated",
              });

              totalProcessed++;
            } else {
              console.error(`process-ivr-queue: VoBiz API error for call ${call.id}: ${vobizResponse.status}`);
              await supabase.from("ivr_campaign_calls").update({
                status: "failed",
                hangup_cause: `VOBIZ_API_ERROR_${vobizResponse.status}`,
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }).eq("id", call.id);

              await supabase.rpc("increment_ivr_campaign_counter", {
                p_campaign_id: campaign.id,
                p_counter_name: "calls_failed",
              });
            }
          } catch (callError) {
            console.error(`process-ivr-queue: error processing call ${call.id}:`, callError);
            await supabase.from("ivr_campaign_calls").update({
              status: "failed",
              hangup_cause: `PROCESS_ERROR: ${String(callError).substring(0, 200)}`,
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }).eq("id", call.id);
          }

          // CPS delay between calls
          if (i < calls.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, cpsDelay));
          }
        }
      } catch (campaignError) {
        console.error(`process-ivr-queue: error processing campaign ${campaign.id}:`, campaignError);
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: totalProcessed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("process-ivr-queue error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
