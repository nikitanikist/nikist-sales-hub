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

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { campaign_id } = await req.json();
    if (!campaign_id) {
      return new Response(JSON.stringify({ error: "campaign_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch campaign
    const { data: campaign, error: campErr } = await supabase
      .from("voice_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single();

    if (campErr || !campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Stop Bolna batch if batch_id exists
    if (campaign.bolna_batch_id) {
      // Resolve Bolna credentials
      const { data: integration } = await supabase
        .from("organization_integrations")
        .select("config")
        .eq("organization_id", campaign.organization_id)
        .eq("integration_type", "bolna")
        .eq("is_active", true)
        .single();

      if (integration) {
        const config = integration.config as Record<string, string>;
        const bolnaApiKey = config.api_key || "";

        if (bolnaApiKey) {
          try {
            await fetchWithRetry(`https://api.bolna.ai/batches/${campaign.bolna_batch_id}/stop`, {
              method: "POST",
              headers: { Authorization: `Bearer ${bolnaApiKey}` },
            }, { timeoutMs: 15000, maxRetries: 2 });
            console.log(`Bolna batch ${campaign.bolna_batch_id} stopped`);
          } catch (e) {
            console.error("Failed to stop Bolna batch:", e.message);
          }
        }
      }
    }

    // Update campaign status
    await supabase.from("voice_campaigns").update({
      status: "paused",
      updated_at: new Date().toISOString(),
    }).eq("id", campaign_id);

    // Cancel pending/queued calls
    await supabase.from("voice_campaign_calls").update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    }).eq("campaign_id", campaign_id).in("status", ["pending", "queued"]);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("stop-voice-campaign error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
