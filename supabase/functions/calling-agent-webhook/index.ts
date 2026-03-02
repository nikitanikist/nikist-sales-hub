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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const executionId = body.id || body.execution_id;
    const telephonyData = body.telephony_data || {};
    const toNumber = telephonyData.to_number || "";
    const callStatus = body.status || "completed";
    const duration = telephonyData.duration || body.conversation_duration || body.conversation_time || body.duration || 0;
    const cost = body.total_cost || 0;
    const transcript = body.transcript || "";
    const recordingUrl = telephonyData.recording_url || "";
    const extractedData = body.extracted_data || body.custom_extractions || null;
    const summary = body.summary || null;
    const contextDetails = body.context_details || null;

    // Detailed field-level logging for debugging
    console.log("Calling Agent Webhook fields:", JSON.stringify({
      executionId,
      callStatus,
      toNumber,
      "telephonyData.duration": telephonyData.duration,
      "body.conversation_duration": body.conversation_duration,
      "body.conversation_time": body.conversation_time,
      "body.duration": body.duration,
      resolvedDuration: duration,
      cost,
      hasSummary: !!summary,
      hasExtractedData: !!extractedData,
      hasTranscript: !!transcript,
      transcriptLength: transcript?.length || 0,
    }));
    const batchId = body.batch_id || "";

    // Find matching call record
    let callRecord: any = null;

    // Try by bolna_call_id first
    if (executionId) {
      const { data } = await supabase
        .from("calling_agent_calls")
        .select("*")
        .eq("bolna_call_id", executionId)
        .single();
      callRecord = data;
    }

    // Fallback: match by phone + campaign batch_id
    if (!callRecord && toNumber) {
      const cleanPhone = toNumber.replace(/^\+/, "");
      const phoneVariants = [toNumber, cleanPhone, `+91${cleanPhone.replace(/^91/, "")}`];

      let matchCampaignId: string | null = null;
      if (batchId) {
        const { data: camp } = await supabase
          .from("calling_agent_campaigns")
          .select("id")
          .eq("bolna_batch_id", batchId)
          .single();
        if (camp) matchCampaignId = camp.id;
      }

      for (const phoneVariant of phoneVariants) {
        let query = supabase.from("calling_agent_calls").select("*");
        if (matchCampaignId) query = query.eq("campaign_id", matchCampaignId);
        const { data } = await query
          .eq("contact_phone", phoneVariant)
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();
        if (data) {
          callRecord = data;
          break;
        }
      }
    }

    if (!callRecord) {
      console.warn("No matching calling_agent_call found. execution_id:", executionId, "phone:", toNumber);
      return new Response(JSON.stringify({ warning: "No matching call record" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map status
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

    // Determine outcome
    let outcome: string | null = null;
    if (mappedStatus === "completed") {
      outcome = "completed";
    } else if (mappedStatus === "no-answer" || mappedStatus === "busy") {
      outcome = "no_response";
    }

    const terminalStatuses = ["completed", "no-answer", "failed", "busy", "cancelled"];
    const safeDuration = Math.floor(Number(duration) || 0);
    const safeCost = Number(cost) || 0;

    if (terminalStatuses.includes(mappedStatus)) {
      // Estimate duration from timestamps if Bolna reported 0 but a real conversation happened
      let finalDuration = safeDuration;
      if (finalDuration === 0 && transcript && transcript.length > 20) {
        // Try to estimate from call_started_at
        if (callRecord.call_started_at) {
          const startedAt = new Date(callRecord.call_started_at).getTime();
          const endedAt = callRecord.call_ended_at ? new Date(callRecord.call_ended_at).getTime() : Date.now();
          const estimatedSeconds = Math.floor((endedAt - startedAt) / 1000);
          if (estimatedSeconds > 0 && estimatedSeconds < 7200) {
            finalDuration = estimatedSeconds;
            console.log(`Duration estimated from timestamps: ${finalDuration}s`);
          }
        }
      }

      // Backfill call_started_at if not set
      if (!callRecord.call_started_at) {
        const startTime = finalDuration > 0
          ? new Date(Date.now() - finalDuration * 1000).toISOString()
          : new Date().toISOString();
        await supabase.from("calling_agent_calls").update({
          call_started_at: startTime,
        }).eq("id", callRecord.id);
      }

      // Use atomic transition function
      const { data: transitionResult, error: transErr } = await supabase.rpc(
        "transition_agent_call_to_terminal",
        {
          p_call_id: callRecord.id,
          p_status: mappedStatus,
          p_outcome: outcome,
          p_bolna_call_id: executionId || null,
          p_duration: finalDuration,
          p_cost: safeCost,
          p_transcript: transcript || null,
          p_summary: summary || null,
          p_recording_url: recordingUrl || null,
          p_extracted_data: extractedData || null,
        }
      );

      if (transErr) {
        console.error("transition_agent_call_to_terminal error:", transErr);
        // Fallback: direct update
        await supabase.from("calling_agent_calls").update({
          bolna_call_id: executionId || callRecord.bolna_call_id,
          status: mappedStatus,
          outcome: outcome || callRecord.outcome,
          call_duration_seconds: finalDuration || callRecord.call_duration_seconds,
          total_cost: safeCost || callRecord.total_cost,
          transcript: transcript || callRecord.transcript,
          summary: summary || callRecord.summary,
          recording_url: recordingUrl || callRecord.recording_url,
          extracted_data: extractedData || callRecord.extracted_data,
          call_ended_at: new Date().toISOString(),
        }).eq("id", callRecord.id);
      }

      // Store context_details if provided
      if (contextDetails && !callRecord.context_details) {
        await supabase.from("calling_agent_calls").update({
          context_details: contextDetails,
        }).eq("id", callRecord.id);
      }

      console.log(`Agent call ${callRecord.id} → ${mappedStatus}, cost: ${safeCost}, duration: ${finalDuration}s`);
    } else {
      // Non-terminal: just update status
      const nonTerminalUpdate: Record<string, any> = {
        bolna_call_id: executionId || callRecord.bolna_call_id,
        status: mappedStatus,
      };
      // Set call_started_at when call goes in-progress
      if (mappedStatus === "in-progress" && !callRecord.call_started_at) {
        nonTerminalUpdate.call_started_at = new Date().toISOString();
      }
      await supabase.from("calling_agent_calls").update(nonTerminalUpdate).eq("id", callRecord.id);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("calling-agent-webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
