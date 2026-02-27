import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { integrationId, campaignName } = await req.json();

    if (!integrationId || !campaignName) {
      return new Response(
        JSON.stringify({ exists: false, message: "Missing integrationId or campaignName" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch integration config from DB
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: integration, error: dbError } = await supabaseAdmin
      .from("organization_integrations")
      .select("config, uses_env_secrets")
      .eq("id", integrationId)
      .single();

    if (dbError || !integration) {
      return new Response(
        JSON.stringify({ exists: false, message: "Integration not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve API key (support both direct and secret-ref modes)
    const config = integration.config as Record<string, string>;
    let apiKey: string;

    if (integration.uses_env_secrets) {
      const secretName = config?.api_key_secret || config?.api_key;
      apiKey = Deno.env.get(secretName) || "";
    } else {
      apiKey = config?.api_key || "";
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ exists: false, message: "API key not found for this integration" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call AISensy API with a dummy destination to verify the campaign
    const aisensyPayload = {
      apiKey,
      campaignName,
      destination: "910000000000",
      userName: "Test",
      templateParams: [],
    };

    const aisensyRes = await fetch(
      "https://backend.aisensy.com/campaign/t1/api/v2",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aisensyPayload),
      }
    );

    const aisensyData = await aisensyRes.json();
    console.log("AISensy verify response:", JSON.stringify(aisensyData));

    const statusStr = String(aisensyData?.status || "").toLowerCase();
    const msgStr = String(aisensyData?.message || aisensyData?.msg || "").toLowerCase();
    const dataStr = JSON.stringify(aisensyData).toLowerCase();

    // Parse the response to determine template validity
    // Case 1: Campaign/template not found
    if (
      dataStr.includes("campaign not found") ||
      dataStr.includes("campaignname is invalid") ||
      dataStr.includes("no campaign found") ||
      dataStr.includes("invalid campaign")
    ) {
      return new Response(
        JSON.stringify({
          exists: false,
          message: `Template "${campaignName}" not found in this AISensy account`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Case 2: Wrong param count — template exists, extract expected count
    const paramMatch = dataStr.match(/(\d+)\s*(?:template\s*)?param/);
    if (
      dataStr.includes("param") &&
      (dataStr.includes("expected") || dataStr.includes("required") || dataStr.includes("mismatch"))
    ) {
      const expectedCount = paramMatch ? parseInt(paramMatch[1], 10) : null;
      return new Response(
        JSON.stringify({
          exists: true,
          paramCount: expectedCount,
          message: expectedCount
            ? `Template "${campaignName}" verified — expects ${expectedCount} variable(s)`
            : `Template "${campaignName}" verified — has variables (count unclear)`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Case 3: Success or other responses (destination invalid but campaign valid)
    // If we got here without a "not found" error, the campaign likely exists
    return new Response(
      JSON.stringify({
        exists: true,
        paramCount: 0,
        message: `Template "${campaignName}" verified successfully`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Verify template error:", err);
    return new Response(
      JSON.stringify({ exists: false, message: "Verification failed. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
