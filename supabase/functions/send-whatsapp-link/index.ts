import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

    // Validate webhook secret (Bolna sends it as a body param)
    const expectedSecret = Deno.env.get("BOLNA_WH_LINK_SECRET");
    if (!expectedSecret || body.webhook_secret !== expectedSecret) {
      console.error("Unauthorized: invalid or missing webhook_secret");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize logs — never print the webhook secret
    const { webhook_secret, ...safeBody } = body;
    console.log("Received from Bolna:", JSON.stringify(safeBody));

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

    // Fetch API key from database (organization_integrations)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const integrationId = body.aisensy_integration_id || "459398a2-dae8-4a20-a4cb-de87cc4add1b";

    const { data: integration, error: intError } = await supabase
      .from("organization_integrations")
      .select("config")
      .eq("id", integrationId)
      .single();

    if (intError || !integration?.config?.api_key) {
      console.error("Failed to fetch AISensy integration:", intError?.message || "No api_key in config");
      return new Response(
        JSON.stringify({ error: "AISensy integration not found or missing api_key" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = integration.config.api_key;

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
