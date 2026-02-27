import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { fetchWithRetry } from "../_shared/fetchWithRetry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Received from Bolna:", JSON.stringify(body));

    const destination = body.whatsapp_number || body.destination;
    const leadName = body.lead_name || body.name || "Friend";
    const workshopName = body.workshop_name || "Workshop";
    const workshopTime = body.workshop_time || "Today";
    const groupLink =
      body.whatsapp_group_link ||
      "https://app.tagfunnel.ai/link/today-whatsapp-group-icc";
    const campaignName = body.campaign_name || "Bolna ai bot";

    if (!destination) {
      return new Response(
        JSON.stringify({ error: "No destination number provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean phone number: remove +, ensure 91 prefix
    const cleanNumber = destination.replace(/\+/g, "").replace(/^0+/, "");
    const finalNumber = cleanNumber.startsWith("91")
      ? cleanNumber
      : `91${cleanNumber}`;

    console.log(
      `Sending WhatsApp to: ${finalNumber}, Name: ${leadName}, Workshop: ${workshopName}, Time: ${workshopTime}`
    );

    const apiKey = Deno.env.get("AISENSY_API_KEY");
    if (!apiKey) {
      console.error("AISENSY_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AISensy API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiSensyPayload = {
      apiKey,
      campaignName,
      destination: finalNumber,
      userName: "Nikistian Media Private Limited 2776",
      templateParams: [leadName, workshopName, workshopTime, groupLink],
      source: "bolna-voice-agent",
      media: {
        url: "https://d3jt6ku4g6z5l8.cloudfront.net/IMAGE/6805dc865e03fc0bfe0a7132/4662926_service%20image.jpeg",
        filename: "sample_media",
      },
      buttons: [],
      carouselCards: [],
      location: {},
      attributes: {},
      paramsFallbackValue: { FirstName: "user" },
    };

    console.log("AiSensy payload:", JSON.stringify(aiSensyPayload));

    const response = await fetchWithRetry(
      "https://backend.aisensy.com/campaign/t1/api/v2",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiSensyPayload),
      },
      { maxRetries: 2, timeoutMs: 10000 }
    );

    const resultText = await response.text();
    console.log(`AiSensy response [${response.status}]:`, resultText);

    return new Response(
      JSON.stringify({
        success: response.ok,
        status: response.status,
        result: resultText,
      }),
      {
        status: response.ok ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in send-whatsapp-link:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
