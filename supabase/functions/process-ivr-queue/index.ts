import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchWithRetry } from "../_shared/fetchWithRetry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIME_BUDGET_MS = 50_000; // Loop for up to 50 seconds
const POLL_INTERVAL_MS = 3_000; // Check for free slots every 3 seconds

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const startTime = Date.now();
    let totalProcessed = 0;

    // ── Auto-start scheduled campaigns whose time has arrived ──
    const { data: scheduledCampaigns } = await supabase
      .from("ivr_campaigns")
      .select("id")
      .eq("status", "scheduled")
      .lte("scheduled_at", new Date().toISOString());

    if (scheduledCampaigns?.length) {
      for (const sc of scheduledCampaigns) {
        console.log(`process-ivr-queue: auto-starting scheduled campaign ${sc.id}`);
        await supabase.from("ivr_campaigns").update({
          status: "running",
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", sc.id);

        await supabase.from("ivr_campaign_calls").update({
          status: "queued",
          queued_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("campaign_id", sc.id).eq("status", "pending");
      }
    }

    // Outer loop: keep processing until time budget is exhausted
    while (Date.now() - startTime < TIME_BUDGET_MS) {
      // Find running campaigns
      const { data: campaigns, error: campaignsError } = await supabase
        .from("ivr_campaigns")
        .select("id, organization_id, vobiz_from_number, calls_per_second, concurrent_limit")
        .eq("status", "running");

      if (campaignsError || !campaigns?.length) break;

      let anyWorkDone = false;

      for (const campaign of campaigns) {
        if (Date.now() - startTime >= TIME_BUDGET_MS) break;

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
            .in("status", ["claiming", "initiated", "answered"]);

          const concurrentLimit = campaign.concurrent_limit || 10;
          const availableSlots = Math.max(0, concurrentLimit - (activeCalls || 0));

          if (availableSlots === 0) {
            console.log(`process-ivr-queue: campaign ${campaign.id} at concurrent limit (${activeCalls}/${concurrentLimit})`);
            continue;
          }

          // Batch size = available slots (not capped by CPS anymore — CPS only controls initiation rate)
          const batchSize = availableSlots;

          // ATOMIC CLAIM: Select queued calls, then immediately mark them as "claiming"
          const { data: candidateCalls } = await supabase
            .from("ivr_campaign_calls")
            .select("id")
            .eq("campaign_id", campaign.id)
            .eq("status", "queued")
            .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
            .order("created_at", { ascending: true })
            .limit(batchSize);

          if (!candidateCalls?.length) continue;

          // Atomically claim by updating status — only rows still "queued" will be updated
          const callIds = candidateCalls.map(c => c.id);
          const { data: claimedCalls } = await supabase
            .from("ivr_campaign_calls")
            .update({ status: "claiming", updated_at: new Date().toISOString() })
            .in("id", callIds)
            .eq("status", "queued")
            .select("id, contact_phone, contact_name");

          if (!claimedCalls?.length) continue;

          anyWorkDone = true;
          const cpsDelay = 1000 / (campaign.calls_per_second || 5);
          const fromNumber = campaign.vobiz_from_number || vobizConfig.from_number || "";

          for (let i = 0; i < claimedCalls.length; i++) {
            if (Date.now() - startTime >= TIME_BUDGET_MS) break;

            const call = claimedCalls[i];

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
            if (i < claimedCalls.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, cpsDelay));
            }
          }
        } catch (campaignError) {
          console.error(`process-ivr-queue: error processing campaign ${campaign.id}:`, campaignError);
        }
      }

      // If no work was done this iteration (all campaigns at limit or no queued calls), wait before retrying
      if (!anyWorkDone) {
        // Check if there are ANY queued calls left across running campaigns
        const { count: totalQueued } = await supabase
          .from("ivr_campaign_calls")
          .select("id", { count: "exact", head: true })
          .eq("status", "queued");

        if (!totalQueued || totalQueued === 0) {
          console.log(`process-ivr-queue: no queued calls remaining, exiting loop`);
          break;
        }
      }

      // Wait before next poll iteration
      if (Date.now() - startTime < TIME_BUDGET_MS) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }

    console.log(`process-ivr-queue: finished after ${((Date.now() - startTime) / 1000).toFixed(1)}s, processed ${totalProcessed} calls`);

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
