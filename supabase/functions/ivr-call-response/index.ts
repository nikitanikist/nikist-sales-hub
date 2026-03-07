import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchWithRetry } from "../_shared/fetchWithRetry.ts";

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
    const retryAttempt = url.searchParams.get("retry") || "0";
    if (!callId) {
      return new Response("<Response><Hangup/></Response>", { headers: corsHeaders });
    }

    // Parse VoBiz form body
    const formData = await req.formData().catch(() => null);
    const body: Record<string, string> = {};
    if (formData) {
      formData.forEach((value, key) => { body[key] = String(value); });
    }

    const speech = body.Speech || body.speech || "";
    const confidence = parseFloat(body.SpeechConfidenceScore || body.Confidence || "0");
    const inputType = body.InputType || body.inputType || "speech";

    console.log(`ivr-call-response: call_id=${callId}, speech="${speech}", confidence=${confidence}, inputType=${inputType}, retry=${retryAttempt}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get call + campaign
    const { data: callRecord } = await supabase
      .from("ivr_campaign_calls")
      .select("campaign_id, contact_phone, contact_name")
      .eq("id", callId)
      .single();

    if (!callRecord) {
      return new Response("<Response><Hangup/></Response>", { headers: corsHeaders });
    }

    const { data: campaign } = await supabase
      .from("ivr_campaigns")
      .select("*")
      .eq("id", callRecord.campaign_id)
      .single();

    if (!campaign) {
      return new Response("<Response><Hangup/></Response>", { headers: corsHeaders });
    }

    // Keyword matching
    const speechLower = speech.toLowerCase().trim();
    const positiveWords = (campaign.positive_keywords || "").split(",").map((w: string) => w.trim().toLowerCase()).filter(Boolean);
    const negativeWords = (campaign.negative_keywords || "").split(",").map((w: string) => w.trim().toLowerCase()).filter(Boolean);

    const isPositive = positiveWords.some((kw: string) => speechLower.includes(kw));
    const isNegative = negativeWords.some((kw: string) => speechLower.includes(kw));

    let outcome: string;
    let counterName: string;

    if (isPositive && !isNegative) {
      outcome = "interested";
      counterName = "calls_interested";
    } else if (isNegative) {
      outcome = "not_interested";
      counterName = "calls_not_interested";
    } else if (!speech || speechLower.length === 0) {
      outcome = "no_response";
      counterName = "calls_no_response";
    } else {
      // Unclear - retry if first attempt
      if (parseInt(retryAttempt) < 1) {
        // Update speech transcript but don't set final outcome yet
        await supabase.from("ivr_campaign_calls").update({
          speech_transcript: speech,
          speech_confidence: confidence,
          detected_input_type: inputType,
          updated_at: new Date().toISOString(),
        }).eq("id", callId);

        const retryActionUrl = `${supabaseUrl}/functions/v1/ivr-call-response?call_id=${callId}&retry=1`;
        const repeatAudio = campaign.audio_repeat_url || campaign.audio_opening_url;
        const goodbyeAudio = campaign.audio_goodbye_url || campaign.audio_not_interested_url;
        const lang = campaign.speech_language || "hi";
        const hints = campaign.speech_hints || "";

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${escapeXml(repeatAudio)}</Play>
    <Gather inputType="speech" speechModel="phone_call" language="${escapeXml(lang)}" hints="${escapeXml(hints)}" speechEndTimeout="3" executionTimeout="6" action="${escapeXml(retryActionUrl)}" method="POST">
    </Gather>
    <Play>${escapeXml(goodbyeAudio)}</Play>
    <Hangup/>
</Response>`;
        return new Response(xml, { headers: corsHeaders });
      }

      outcome = "unclear";
      counterName = "calls_no_response";
    }

    console.log(`ivr-call-response: outcome=${outcome} for call ${callId}`);

    // Update call record
    await supabase.rpc("transition_ivr_call", {
      p_call_id: callId,
      p_new_status: "completed",
      p_outcome: outcome,
      p_speech: speech,
      p_confidence: confidence,
    });

    // Increment campaign counter
    await supabase.rpc("increment_ivr_campaign_counter", {
      p_campaign_id: campaign.id,
      p_counter_name: counterName,
    });

    // If interested, trigger WhatsApp
    if (outcome === "interested" && campaign.on_yes_action === "send_whatsapp" && campaign.on_yes_template_name) {
      // Fire WhatsApp async (don't block XML response)
      sendWhatsApp(supabase, campaign, callRecord, callId).catch((err) => {
        console.error(`ivr-call-response: WhatsApp send error for call ${callId}:`, err);
      });
    }

    // Return appropriate audio
    let audioUrl: string;
    if (outcome === "interested") {
      audioUrl = campaign.audio_thankyou_url;
    } else {
      audioUrl = campaign.audio_not_interested_url;
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${escapeXml(audioUrl)}</Play>
    <Hangup/>
</Response>`;

    return new Response(xml, { headers: corsHeaders });
  } catch (error) {
    console.error("ivr-call-response error:", error);
    return new Response("<Response><Hangup/></Response>", { headers: corsHeaders });
  }
});

async function sendWhatsApp(
  supabase: any,
  campaign: any,
  callRecord: any,
  callId: string
) {
  try {
    // Resolve AiSensy credentials: campaign-level > org integration > env
    let apiKey: string | null = null;
    let source: string | null = null;

    if (campaign.aisensy_integration_id) {
      const { data: integration } = await supabase
        .from("organization_integrations")
        .select("config")
        .eq("id", campaign.aisensy_integration_id)
        .single();

      if (integration?.config) {
        apiKey = integration.config.api_key;
        source = integration.config.source;
      }
    }

    if (!apiKey) {
      // Try org-level AiSensy integration
      const { data: orgIntegration } = await supabase
        .from("organization_integrations")
        .select("config")
        .eq("organization_id", campaign.organization_id)
        .eq("integration_type", "aisensy")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (orgIntegration?.config) {
        apiKey = orgIntegration.config.api_key;
        source = orgIntegration.config.source;
      }
    }

    if (!apiKey) {
      apiKey = Deno.env.get("AISENSY_API_KEY") || null;
      source = Deno.env.get("AISENSY_SOURCE") || null;
    }

    if (!apiKey) {
      console.error(`ivr-call-response: No AiSensy API key found for campaign ${campaign.id}`);
      await supabase.from("ivr_campaign_calls").update({
        whatsapp_error: "No AiSensy API key configured",
        updated_at: new Date().toISOString(),
      }).eq("id", callId);
      return;
    }

    // Format phone number
    let phone = callRecord.contact_phone.replace(/\D/g, "");
    if (phone.startsWith("0")) phone = "91" + phone.substring(1);
    if (!phone.startsWith("91")) phone = "91" + phone;

    const payload: any = {
      apiKey,
      campaignName: campaign.on_yes_template_name,
      destination: phone,
      userName: callRecord.contact_name || "there",
      source: source || "ivr-campaign",
      templateParams: campaign.on_yes_template_params || [],
    };

    if (campaign.on_yes_media_url) {
      payload.media = { url: campaign.on_yes_media_url, filename: "media" };
    }

    console.log(`ivr-call-response: sending WhatsApp to ${phone} with template ${campaign.on_yes_template_name}`);

    const response = await fetchWithRetry(
      "https://backend.aisensy.com/campaign/t1/api/v2",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      { timeoutMs: 10000, maxRetries: 2 }
    );

    const responseText = await response.text();
    console.log(`ivr-call-response: AiSensy response for call ${callId}: ${response.status} ${responseText.substring(0, 200)}`);

    if (response.ok) {
      await supabase.from("ivr_campaign_calls").update({
        whatsapp_sent: true,
        whatsapp_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", callId);
    } else {
      await supabase.from("ivr_campaign_calls").update({
        whatsapp_error: `AiSensy ${response.status}: ${responseText.substring(0, 500)}`,
        updated_at: new Date().toISOString(),
      }).eq("id", callId);
    }
  } catch (error) {
    console.error(`sendWhatsApp error for call ${callId}:`, error);
    await supabase.from("ivr_campaign_calls").update({
      whatsapp_error: String(error),
      updated_at: new Date().toISOString(),
    }).eq("id", callId);
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
