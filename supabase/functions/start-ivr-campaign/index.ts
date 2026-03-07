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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { campaign_id } = await req.json();
    if (!campaign_id) {
      return new Response(JSON.stringify({ error: "campaign_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for updates
    const serviceSupabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Validate campaign exists and is startable
    const { data: campaign, error: campaignError } = await serviceSupabase
      .from("ivr_campaigns")
      .select("id, status, organization_id")
      .eq("id", campaign_id)
      .single();

    if (campaignError || !campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["draft", "scheduled"].includes(campaign.status)) {
      return new Response(JSON.stringify({ error: `Campaign cannot be started from status: ${campaign.status}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`start-ivr-campaign: starting campaign ${campaign_id}`);

    // Update campaign status
    await serviceSupabase.from("ivr_campaigns").update({
      status: "running",
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", campaign_id);

    // Mark all pending calls as queued
    const { count } = await serviceSupabase
      .from("ivr_campaign_calls")
      .update({
        status: "queued",
        queued_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { count: "exact" })
      .eq("campaign_id", campaign_id)
      .eq("status", "pending");

    console.log(`start-ivr-campaign: queued ${count} calls for campaign ${campaign_id}`);

    return new Response(JSON.stringify({ ok: true, queued: count }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("start-ivr-campaign error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
