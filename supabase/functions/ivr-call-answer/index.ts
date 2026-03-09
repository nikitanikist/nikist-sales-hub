import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/xml",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const callId = url.searchParams.get("call_id");
    if (!callId) {
      console.error("ivr-call-answer: missing call_id");
      return new Response("<Response><Hangup/></Response>", { headers: corsHeaders });
    }

    // Parse VoBiz POST body (form-urlencoded)
    const formData = await req.formData().catch(() => null);
    const body: Record<string, string> = {};
    if (formData) {
      formData.forEach((value, key) => { body[key] = String(value); });
    }

    console.log(`ivr-call-answer: call_id=${callId}, CallUUID=${body.CallUUID}, MachineDetection=${body.Machine}, From=${body.From}, To=${body.To}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update call with VoBiz data
    await supabase.from("ivr_campaign_calls").update({
      status: "answered",
      vobiz_call_uuid: body.CallUUID || null,
      vobiz_from: body.From || null,
      vobiz_to: body.To || null,
      answered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", callId);

    // Check for voicemail/machine detection
    const machineDetected = body.Machine === "true" || body.MachineDetection === "true";
    if (machineDetected) {
      console.log(`ivr-call-answer: voicemail detected for call ${callId}`);
      await supabase.from("ivr_campaign_calls").update({
        status: "voicemail",
        outcome: "voicemail",
        answered_by_voicemail: true,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", callId);

      const { data: callData } = await supabase.from("ivr_campaign_calls").select("campaign_id").eq("id", callId).single();
      if (callData) {
        await supabase.rpc("increment_ivr_campaign_counter", { p_campaign_id: callData.campaign_id, p_counter_name: "calls_voicemail" });
      }

      return new Response("<Response><Hangup/></Response>", { headers: corsHeaders });
    }

    // Get campaign config for audio URL
    const { data: callRecord } = await supabase
      .from("ivr_campaign_calls")
      .select("campaign_id")
      .eq("id", callId)
      .single();

    if (!callRecord) {
      console.error(`ivr-call-answer: call record not found for ${callId}`);
      return new Response("<Response><Hangup/></Response>", { headers: corsHeaders });
    }

    const { data: campaign } = await supabase
      .from("ivr_campaigns")
      .select("id, audio_opening_url")
      .eq("id", callRecord.campaign_id)
      .single();

    if (!campaign) {
      console.error(`ivr-call-answer: campaign not found for call ${callId}`);
      return new Response("<Response><Hangup/></Response>", { headers: corsHeaders });
    }

    // Increment answered counter
    await supabase.rpc("increment_ivr_campaign_counter", { p_campaign_id: campaign.id, p_counter_name: "calls_answered" });

    // Simple broadcast: Play audio then hang up
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${escapeXml(campaign.audio_opening_url)}</Play>
    <Hangup/>
</Response>`;

    console.log(`ivr-call-answer: returning broadcast XML for call ${callId}`);
    return new Response(xml, { headers: corsHeaders });
  } catch (error) {
    console.error("ivr-call-answer error:", error);
    return new Response("<Response><Hangup/></Response>", { headers: corsHeaders });
  }
});

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
