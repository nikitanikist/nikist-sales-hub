import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const callId = url.searchParams.get("call_id");
    if (!callId) {
      console.error("ivr-call-hangup: missing call_id");
      return new Response(JSON.stringify({ error: "missing call_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse VoBiz form body
    const formData = await req.formData().catch(() => null);
    const body: Record<string, string> = {};
    if (formData) {
      formData.forEach((value, key) => { body[key] = String(value); });
    }

    const duration = parseFloat(body.Duration || body.CallDuration || "0");
    const hangupCause = body.HangupCause || body.Cause || "NORMAL_CLEARING";
    const callStatus = body.CallStatus || "";
    const callUuid = body.CallUUID || "";

    console.log(`ivr-call-hangup: call_id=${callId}, duration=${duration}, hangupCause=${hangupCause}, callStatus=${callStatus}, CallUUID=${callUuid}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get call record
    const { data: callRecord } = await supabase
      .from("ivr_campaign_calls")
      .select("id, campaign_id, status, outcome, retry_count")
      .eq("id", callId)
      .single();

    if (!callRecord) {
      console.error(`ivr-call-hangup: call not found ${callId}`);
      return new Response(JSON.stringify({ ok: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map hangup cause to status
    let newStatus: string;
    let counterName: string;

    // If call was already completed by response handler, keep it
    if (["completed", "voicemail"].includes(callRecord.status)) {
      // Just update duration/cost
      const estimatedCost = duration * 0.005; // ~₹0.30/min = ₹0.005/sec
      await supabase.from("ivr_campaign_calls").update({
        call_duration_seconds: duration,
        call_cost: estimatedCost,
        hangup_cause: hangupCause,
        updated_at: new Date().toISOString(),
      }).eq("id", callId);

      await supabase.rpc("add_ivr_campaign_cost", {
        p_campaign_id: callRecord.campaign_id,
        p_cost: estimatedCost,
        p_duration: duration,
      });

      // Check campaign completion
      await checkCampaignCompletion(supabase, callRecord.campaign_id);

      return new Response(JSON.stringify({ ok: true, status: callRecord.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine status from hangup cause
    switch (hangupCause) {
      case "NO_ANSWER":
      case "ORIGINATOR_CANCEL":
      case "NO_USER_RESPONSE":
        newStatus = "no_answer";
        counterName = "calls_no_answer";
        break;
      case "USER_BUSY":
      case "CALL_REJECTED":
        newStatus = "busy";
        counterName = "calls_busy";
        break;
      case "UNALLOCATED_NUMBER":
      case "NO_ROUTE_DESTINATION":
      case "INVALID_NUMBER_FORMAT":
      case "RECOVERY_ON_TIMER_EXPIRE":
        newStatus = "failed";
        counterName = "calls_failed";
        break;
      case "NORMAL_CLEARING":
        // If already answered, it was completed by response handler
        if (callRecord.status === "answered" && !callRecord.outcome) {
          newStatus = "completed";
          counterName = "calls_no_response";
        } else {
          newStatus = callRecord.status === "initiated" ? "no_answer" : "completed";
          counterName = callRecord.status === "initiated" ? "calls_no_answer" : "calls_no_response";
        }
        break;
      default:
        newStatus = "failed";
        counterName = "calls_failed";
    }

    const estimatedCost = duration * 0.005;

    // Transition call
    const { data: transitioned } = await supabase.rpc("transition_ivr_call", {
      p_call_id: callId,
      p_new_status: newStatus,
      p_outcome: callRecord.outcome || (newStatus === "no_answer" ? null : "no_response"),
      p_duration: duration,
      p_cost: estimatedCost,
      p_hangup_cause: hangupCause,
      p_vobiz_call_uuid: callUuid || null,
    });

    // Increment counter
    await supabase.rpc("increment_ivr_campaign_counter", {
      p_campaign_id: callRecord.campaign_id,
      p_counter_name: counterName,
    });

    // Add cost
    await supabase.rpc("add_ivr_campaign_cost", {
      p_campaign_id: callRecord.campaign_id,
      p_cost: estimatedCost,
      p_duration: duration,
    });

    // Handle retry logic for no_answer
    if (newStatus === "no_answer") {
      const { data: campaign } = await supabase
        .from("ivr_campaigns")
        .select("retry_no_answer, max_retries, retry_delay_minutes")
        .eq("id", callRecord.campaign_id)
        .single();

      if (campaign?.retry_no_answer && callRecord.retry_count < (campaign.max_retries || 1)) {
        const retryDelayMs = (campaign.retry_delay_minutes || 30) * 60 * 1000;
        const nextRetryAt = new Date(Date.now() + retryDelayMs).toISOString();

        console.log(`ivr-call-hangup: scheduling retry for call ${callId} at ${nextRetryAt} (attempt ${callRecord.retry_count + 1})`);

        await supabase.from("ivr_campaign_calls").update({
          status: "queued",
          retry_count: callRecord.retry_count + 1,
          last_retry_at: new Date().toISOString(),
          next_retry_at: nextRetryAt,
          completed_at: null,
          updated_at: new Date().toISOString(),
        }).eq("id", callId);
      }
    }

    // Check campaign completion
    await checkCampaignCompletion(supabase, callRecord.campaign_id);

    return new Response(JSON.stringify({ ok: true, status: newStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ivr-call-hangup error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function checkCampaignCompletion(supabase: any, campaignId: string) {
  const { count } = await supabase
    .from("ivr_campaign_calls")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .in("status", ["pending", "queued", "initiated", "answered"]);

  if (count === 0) {
    console.log(`ivr-call-hangup: all calls done, marking campaign ${campaignId} as completed`);
    await supabase.from("ivr_campaigns").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", campaignId).eq("status", "running");
  }
}
