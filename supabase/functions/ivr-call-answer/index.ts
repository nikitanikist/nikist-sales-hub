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

    const formData = await req.formData().catch(() => null);
    const body: Record<string, string> = {};
    if (formData) {
      formData.forEach((value, key) => { body[key] = String(value); });
    }

    console.log(`ivr-call-answer: call_id=${callId}, CallUUID=${body.CallUUID}, Machine=${body.Machine}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check voicemail FIRST — needs to return <Hangup/> so must be blocking
    const machineDetected = body.Machine === "true" || body.MachineDetection === "true";
    if (machineDetected) {
      console.log(`ivr-call-answer: voicemail detected for call ${callId}`);
      // Fire-and-forget voicemail updates
      const vmPromise = (async () => {
        await supabase.from("ivr_campaign_calls").update({
          status: "voicemail", outcome: "voicemail", answered_by_voicemail: true,
          vobiz_call_uuid: body.CallUUID || null,
          completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq("id", callId);
        const { data: cd } = await supabase.from("ivr_campaign_calls").select("campaign_id").eq("id", callId).single();
        if (cd) await supabase.rpc("increment_ivr_campaign_counter", { p_campaign_id: cd.campaign_id, p_counter_name: "calls_voicemail" });
      })();
      // Don't await — return immediately
      vmPromise.catch(e => console.error("ivr-call-answer: voicemail bg error", e));
      return new Response("<Response><Hangup/></Response>", { headers: corsHeaders });
    }

    // FAST PATH: Single query with join to get audio URL
    const { data: callRecord, error } = await supabase
      .from("ivr_campaign_calls")
      .select("campaign_id, ivr_campaigns(id, audio_opening_url)")
      .eq("id", callId)
      .single();

    if (error || !callRecord || !callRecord.ivr_campaigns) {
      console.error(`ivr-call-answer: lookup failed for ${callId}`, error);
      return new Response("<Response><Hangup/></Response>", { headers: corsHeaders });
    }

    const campaign = callRecord.ivr_campaigns as any;
    const audioUrl = campaign.audio_opening_url;

    if (!audioUrl) {
      console.error(`ivr-call-answer: no audio URL for campaign ${campaign.id}`);
      return new Response("<Response><Hangup/></Response>", { headers: corsHeaders });
    }

    // Build XML response IMMEDIATELY
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${escapeXml(audioUrl)}</Play>
    <Hangup/>
</Response>`;

    console.log(`ivr-call-answer: returning XML for call ${callId} (~0 delay)`);

    // Fire-and-forget: status update + counter increment (runs after response is sent)
    const bgPromise = (async () => {
      await supabase.from("ivr_campaign_calls").update({
        status: "answered",
        vobiz_call_uuid: body.CallUUID || null,
        vobiz_from: body.From || null,
        vobiz_to: body.To || null,
        answered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", callId);
      await supabase.rpc("increment_ivr_campaign_counter", { p_campaign_id: campaign.id, p_counter_name: "calls_answered" });
    })();
    bgPromise.catch(e => console.error("ivr-call-answer: bg update error", e));

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
