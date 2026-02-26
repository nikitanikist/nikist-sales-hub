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

    // Resolve Bolna credentials from organization_integrations
    const { data: integration } = await supabase
      .from("organization_integrations")
      .select("config")
      .eq("organization_id", campaign.organization_id)
      .eq("integration_type", "bolna")
      .eq("is_active", true)
      .single();

    if (!integration) {
      return new Response(JSON.stringify({ error: "Bolna integration not configured. Add it in Settings > Integrations." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const config = integration.config as Record<string, string>;
    const bolnaApiKey = config.api_key || "";
    const bolnaAgentId = campaign.bolna_agent_id || config.agent_id || "";

    if (!bolnaApiKey || !bolnaAgentId) {
      return new Response(JSON.stringify({ error: "Bolna API key or Agent ID missing" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch pending calls
    const { data: calls, error: callsErr } = await supabase
      .from("voice_campaign_calls")
      .select("id, contact_name, contact_phone")
      .eq("campaign_id", campaign_id)
      .eq("status", "pending");

    if (callsErr || !calls || calls.length === 0) {
      return new Response(JSON.stringify({ error: "No pending calls found" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Generate CSV for Bolna Batch API
    const workshopTime = campaign.workshop_time || "7 PM";
    const csvHeader = "contact_number,lead_name,workshop_time,call_id";
    const csvRows = calls.map((c: any) => {
      const phone = c.contact_phone.startsWith("+") ? c.contact_phone : `+91${c.contact_phone}`;
      // Escape commas in names
      const safeName = c.contact_name.includes(",") ? `"${c.contact_name}"` : c.contact_name;
      return `${phone},${safeName},${workshopTime},${c.id}`;
    });
    const csvContent = [csvHeader, ...csvRows].join("\n");

    console.log(`Starting campaign ${campaign_id}: ${calls.length} contacts`);

    // Step 1: Create batch with Bolna
    const formData = new FormData();
    formData.append("agent_id", bolnaAgentId);
    formData.append("file", new Blob([csvContent], { type: "text/csv" }), "contacts.csv");

    const batchRes = await fetchWithRetry("https://api.bolna.ai/batches", {
      method: "POST",
      headers: { Authorization: `Bearer ${bolnaApiKey}` },
      body: formData,
    }, { timeoutMs: 15000, maxRetries: 2 });

    if (!batchRes.ok) {
      const errText = await batchRes.text();
      console.error("Bolna batch create failed:", batchRes.status, errText);
      await supabase.from("voice_campaigns").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", campaign_id);
      return new Response(JSON.stringify({ error: "Failed to create Bolna batch", details: errText }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const batchData = await batchRes.json();
    const batchId = batchData.batch_id || batchData.id;
    console.log(`Bolna batch created: ${batchId}`);

    // Step 2: Schedule batch (immediately or at scheduled_at)
    const scheduleForm = new FormData();
    const scheduleTime = campaign.scheduled_at || new Date().toISOString();
    scheduleForm.append("scheduled_at", scheduleTime);

    const scheduleRes = await fetchWithRetry(`https://api.bolna.ai/batches/${batchId}/schedule`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bolnaApiKey}` },
      body: scheduleForm,
    }, { timeoutMs: 15000, maxRetries: 2 });

    if (!scheduleRes.ok) {
      const errText = await scheduleRes.text();
      console.error("Bolna batch schedule failed:", scheduleRes.status, errText);
    }

    // Step 3: Update campaign
    await supabase.from("voice_campaigns").update({
      status: "running",
      bolna_batch_id: batchId,
      bolna_agent_id: bolnaAgentId,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", campaign_id);

    // Step 4: Update all calls to queued
    await supabase.from("voice_campaign_calls").update({
      status: "queued",
      updated_at: new Date().toISOString(),
    }).eq("campaign_id", campaign_id).eq("status", "pending");

    return new Response(JSON.stringify({ success: true, batch_id: batchId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("start-voice-campaign error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
