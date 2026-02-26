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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    console.log("Webhook received, type:", body.tool_name ? "tool_call" : "post_call");

    // ──────────────────────────────────────────
    // TYPE A: Custom Tool Calls (during conversation)
    // ──────────────────────────────────────────
    if (body.tool_name) {
      const { tool_name, call_id } = body;

      if (!call_id) {
        return new Response(JSON.stringify({ error: "call_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Fetch the call record to get campaign context
      const { data: callRecord, error: callErr } = await supabase
        .from("voice_campaign_calls")
        .select("*, voice_campaigns!inner(organization_id, workshop_id, whatsapp_template_id)")
        .eq("id", call_id)
        .single();

      if (callErr || !callRecord) {
        console.error("Call record not found for id:", call_id);
        return new Response(JSON.stringify({ error: "Call not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const campaignId = callRecord.campaign_id;

      if (tool_name === "mark_attendance") {
        const outcome = body.outcome || "confirmed";
        const counterField = outcome === "confirmed" ? "calls_confirmed"
          : outcome === "not_interested" ? "calls_not_interested"
          : outcome === "angry" ? "calls_not_interested" // count angry as not_interested for counter
          : "calls_completed";

        await supabase.from("voice_campaign_calls").update({
          outcome,
          status: "completed",
          updated_at: new Date().toISOString(),
        }).eq("id", call_id);

        console.log(`mark_attendance: ${outcome} for call ${call_id}`);

      } else if (tool_name === "reschedule_lead") {
        const rescheduleDay = body.reschedule_day || "Unknown";

        await supabase.from("voice_campaign_calls").update({
          outcome: "rescheduled",
          reschedule_day: rescheduleDay,
          status: "completed",
          updated_at: new Date().toISOString(),
        }).eq("id", call_id);

        console.log(`reschedule_lead: ${rescheduleDay} for call ${call_id}`);

      } else if (tool_name === "send_whatsapp_group_link") {
        // Look up workshop whatsapp group link
        const campaign = (callRecord as any).voice_campaigns;
        const workshopId = campaign?.workshop_id;
        const templateId = campaign?.whatsapp_template_id;
        const orgId = campaign?.organization_id;

        let whatsappLink = "";
        if (workshopId) {
          const { data: workshop } = await supabase
            .from("workshops")
            .select("whatsapp_group_link")
            .eq("id", workshopId)
            .single();
          whatsappLink = workshop?.whatsapp_group_link || "";
        }

        // Send via AiSensy if template + link available
        if (templateId && whatsappLink && orgId) {
          // Resolve AiSensy credentials
          const { data: aisensyIntegration } = await supabase
            .from("organization_integrations")
            .select("config, uses_env_secrets")
            .eq("organization_id", orgId)
            .eq("type", "aisensy")
            .eq("is_active", true)
            .single();

          let aisensyApiKey = "";
          if (aisensyIntegration) {
            const cfg = aisensyIntegration.config as Record<string, string>;
            aisensyApiKey = aisensyIntegration.uses_env_secrets
              ? Deno.env.get(cfg.api_key_secret || "") || ""
              : cfg.api_key || "";
          }
          // Fallback to env
          if (!aisensyApiKey) {
            aisensyApiKey = Deno.env.get("AISENSY_API_KEY") || "";
          }

          if (aisensyApiKey) {
            const phone = callRecord.contact_phone.replace(/^\+/, "");
            try {
              await fetchWithRetry("https://backend.aisensy.com/campaign/t1/api/v2", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  apiKey: aisensyApiKey,
                  campaignName: templateId,
                  destination: phone,
                  templateParams: [whatsappLink],
                }),
              }, { timeoutMs: 10000 });
              console.log(`WhatsApp link sent for call ${call_id}`);
            } catch (e) {
              console.error("AiSensy send failed:", e.message);
            }
          }
        }

        await supabase.from("voice_campaign_calls").update({
          in_whatsapp_group: false,
          whatsapp_link_sent: true,
          updated_at: new Date().toISOString(),
        }).eq("id", call_id);
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ──────────────────────────────────────────
    // TYPE B: Post-Call Webhook (after call ends)
    // ──────────────────────────────────────────
    const executionId = body.id || body.execution_id;
    const telephonyData = body.telephony_data || {};
    const toNumber = telephonyData.to_number || "";
    const callStatus = body.status || "completed";
    const duration = telephonyData.duration || body.conversation_time || 0;
    const cost = body.total_cost || 0;
    const transcript = body.transcript || "";
    const recordingUrl = telephonyData.recording_url || "";
    const extractedData = body.extracted_data || null;
    const batchId = body.batch_id || "";

    // Find matching call record
    let callRecord: any = null;

    // Try by bolna_call_id first
    if (executionId) {
      const { data } = await supabase
        .from("voice_campaign_calls")
        .select("*")
        .eq("bolna_call_id", executionId)
        .single();
      callRecord = data;
    }

    // Fallback: match by phone number + campaign's bolna_batch_id
    if (!callRecord && toNumber) {
      const cleanPhone = toNumber.replace(/^\+/, "");
      const phoneVariants = [toNumber, cleanPhone, `+91${cleanPhone.replace(/^91/, "")}`];

      // Find campaigns with this batch
      let campaignFilter: any = supabase.from("voice_campaign_calls").select("*");
      
      if (batchId) {
        const { data: camp } = await supabase
          .from("voice_campaigns")
          .select("id")
          .eq("bolna_batch_id", batchId)
          .single();
        if (camp) {
          campaignFilter = campaignFilter.eq("campaign_id", camp.id);
        }
      }

      for (const phoneVariant of phoneVariants) {
        // Include terminal statuses so Bolna retries can match already-processed calls
        const { data } = await campaignFilter.eq("contact_phone", phoneVariant).order("updated_at", { ascending: false }).limit(1).single();
        if (data) {
          callRecord = data;
          break;
        }
      }
    }

    if (!callRecord) {
      console.warn("No matching call record found for webhook. execution_id:", executionId, "phone present:", !!toNumber);
      return new Response(JSON.stringify({ warning: "No matching call record" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Map Bolna status
    const statusMap: Record<string, string> = {
      queued: "queued",
      ringing: "ringing",
      "in-progress": "in-progress",
      completed: "completed",
      busy: "busy",
      "no-answer": "no-answer",
      failed: "failed",
      cancelled: "cancelled",
    };
    const mappedStatus = statusMap[callStatus] || "completed";

    // Determine outcome if not already set
    let outcome = callRecord.outcome;
    if (!outcome && mappedStatus === "completed") {
      if (extractedData?.attendance) {
        outcome = extractedData.attendance;
      } else {
        outcome = "no_response";
      }
    }
    if (!outcome && (mappedStatus === "no-answer" || mappedStatus === "busy")) {
      outcome = "no_response";
    }

    // Update call record
    await supabase.from("voice_campaign_calls").update({
      bolna_call_id: executionId || callRecord.bolna_call_id,
      status: mappedStatus,
      outcome: outcome || callRecord.outcome,
      call_duration_seconds: duration,
      total_cost: cost,
      transcript: transcript || callRecord.transcript,
      recording_url: recordingUrl || callRecord.recording_url,
      extracted_data: extractedData || callRecord.extracted_data,
      call_ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", callRecord.id);

    // Update campaign cost (no erroneous counter increment)
    if (cost > 0) {
      const { data: currentCampaign } = await supabase
        .from("voice_campaigns")
        .select("total_cost")
        .eq("id", callRecord.campaign_id)
        .single();
      
      if (currentCampaign) {
        await supabase.from("voice_campaigns").update({
          total_cost: (currentCampaign.total_cost || 0) + cost,
          updated_at: new Date().toISOString(),
        }).eq("id", callRecord.campaign_id);
      }
    }

    // Only update counters if call was NOT already in a terminal status (idempotent)
    const terminalStatuses = ["completed", "no-answer", "failed", "busy", "cancelled"];
    const wasAlreadyTerminal = terminalStatuses.includes(callRecord.status);

    if (!wasAlreadyTerminal && terminalStatuses.includes(mappedStatus)) {
      // Increment calls_completed exactly once per call reaching terminal state
      await supabase.rpc("increment_campaign_counter", { p_campaign_id: callRecord.campaign_id, p_field: "calls_completed" });

      // Update outcome-based counter (if not already done by tool call)
      if (outcome && !callRecord.outcome) {
        const counterMap: Record<string, string> = {
          confirmed: "calls_confirmed",
          rescheduled: "calls_rescheduled",
          not_interested: "calls_not_interested",
          angry: "calls_not_interested",
          no_response: "calls_no_answer",
          no_answer: "calls_no_answer",
        };
        const field = counterMap[outcome];
        if (field) {
          await supabase.rpc("increment_campaign_counter", { p_campaign_id: callRecord.campaign_id, p_field: field });
        }
      }
    }

    // Clean up stale queued calls (invalid numbers Bolna skipped)
    const { data: campaignInfo } = await supabase
      .from("voice_campaigns")
      .select("started_at")
      .eq("id", callRecord.campaign_id)
      .single();

    if (campaignInfo?.started_at) {
      const tenMinutesAfterStart = new Date(new Date(campaignInfo.started_at).getTime() + 10 * 60 * 1000).toISOString();
      const now = new Date().toISOString();

      if (now > tenMinutesAfterStart) {
        const { data: staleCalls } = await supabase
          .from("voice_campaign_calls")
          .select("id")
          .eq("campaign_id", callRecord.campaign_id)
          .in("status", ["queued", "pending"])
          .lt("created_at", tenMinutesAfterStart);

        if (staleCalls && staleCalls.length > 0) {
          const staleIds = staleCalls.map(c => c.id);
          await supabase.from("voice_campaign_calls").update({
            status: "failed",
            outcome: "invalid_number",
            updated_at: now,
          }).in("id", staleIds);

          // Increment counters for each stale call
          for (const _ of staleIds) {
            await supabase.rpc("increment_campaign_counter", { p_campaign_id: callRecord.campaign_id, p_field: "calls_completed" });
            await supabase.rpc("increment_campaign_counter", { p_campaign_id: callRecord.campaign_id, p_field: "calls_no_answer" });
          }
          console.log(`Marked ${staleIds.length} stale queued calls as failed`);
        }
      }
    }

    // Check if all calls are done
    const { count: pendingCount } = await supabase
      .from("voice_campaign_calls")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", callRecord.campaign_id)
      .in("status", ["pending", "queued", "ringing", "in-progress"]);

    if (pendingCount === 0) {
      await supabase.from("voice_campaigns").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", callRecord.campaign_id);
      console.log(`Campaign ${callRecord.campaign_id} completed`);
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("bolna-webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
