import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchWithRetry } from "../_shared/fetchWithRetry.ts";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve user's organization
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: "No organization found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orgId = membership.organization_id;

    // Fetch Bolna credentials from organization_integrations
    const { data: integration } = await supabase
      .from("organization_integrations")
      .select("config")
      .eq("organization_id", orgId)
      .eq("integration_type", "bolna")
      .eq("is_active", true)
      .single();

    if (!integration) {
      return new Response(
        JSON.stringify({ error: "bolna_not_configured", message: "Bolna integration not configured. Add it in Settings > Integrations." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = integration.config as Record<string, string>;
    const bolnaApiKey = config.api_key || "";

    if (!bolnaApiKey) {
      return new Response(
        JSON.stringify({ error: "bolna_not_configured", message: "Bolna API key is missing." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch agents from Bolna API
    const agentsRes = await fetchWithRetry("https://api.bolna.ai/v2/agent/all", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${bolnaApiKey}`,
        "Content-Type": "application/json",
      },
    }, { timeoutMs: 10000, maxRetries: 2 });

    if (!agentsRes.ok) {
      const errText = await agentsRes.text();
      console.error("Bolna agents fetch failed:", agentsRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch agents from Bolna", details: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const agentsData = await agentsRes.json();

    // Normalize response — Bolna returns an array of agent objects
    const agents = Array.isArray(agentsData)
      ? agentsData.map((a: any) => ({
          id: a.id || a.agent_id,
          name: a.agent_name || a.name || "Unnamed Agent",
        }))
      : [];

    return new Response(
      JSON.stringify({ agents }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("list-bolna-agents error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
