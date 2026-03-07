import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/xml",
};

function mapLanguageCode(lang: string): string {
  const map: Record<string, string> = {
    hi: "hi-IN",
    en: "en-US",
    bn: "bn-IN",
    ta: "ta-IN",
    te: "te-IN",
    mr: "mr-IN",
    gu: "gu-IN",
    kn: "kn-IN",
    ml: "ml-IN",
    pa: "pa-IN",
    ur: "ur-IN",
  };
  if (lang.includes("-")) return lang; // already BCP-47
  return map[lang.toLowerCase()] || `${lang}-IN`;
}

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

    // Get campaign config for audio URLs and speech settings
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
      .select("*")
      .eq("id", callRecord.campaign_id)
      .single();

    if (!campaign) {
      console.error(`ivr-call-answer: campaign not found for call ${callId}`);
      return new Response("<Response><Hangup/></Response>", { headers: corsHeaders });
    }

    // Increment answered counter
    await supabase.rpc("increment_ivr_campaign_counter", { p_campaign_id: campaign.id, p_counter_name: "calls_answered" });

    const actionUrl = `${supabaseUrl}/functions/v1/ivr-call-response?call_id=${callId}`;
    const repeatAudio = campaign.audio_repeat_url || campaign.audio_opening_url;
    const goodbyeAudio = campaign.audio_goodbye_url || campaign.audio_not_interested_url;
    const lang = mapLanguageCode(campaign.speech_language || "hi");
    const hints = campaign.speech_hints || "";

    // Build XML response — Play nested INSIDE Gather per VoBiz docs
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather inputType="speech" speechModel="phone_call" language="${escapeXml(lang)}" hints="${escapeXml(hints)}" speechEndTimeout="3" executionTimeout="8" action="${escapeXml(actionUrl)}" method="POST">
        <Play>${escapeXml(campaign.audio_opening_url)}</Play>
    </Gather>
    <Gather inputType="speech" speechModel="phone_call" language="${escapeXml(lang)}" hints="${escapeXml(hints)}" speechEndTimeout="3" executionTimeout="6" action="${escapeXml(actionUrl)}" method="POST">
        <Play>${escapeXml(repeatAudio)}</Play>
    </Gather>
    <Play>${escapeXml(goodbyeAudio)}</Play>
    <Hangup/>
</Response>`;

    console.log(`ivr-call-answer: returning XML for call ${callId}:\n${xml}`);
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