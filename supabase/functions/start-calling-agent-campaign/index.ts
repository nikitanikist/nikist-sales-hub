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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
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

    // Fetch campaign
    const { data: campaign, error: campErr } = await supabase
      .from("calling_agent_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single();

    if (campErr || !campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve Bolna credentials
    const { data: integration } = await supabase
      .from("organization_integrations")
      .select("config")
      .eq("organization_id", campaign.organization_id)
      .eq("integration_type", "bolna")
      .eq("is_active", true)
      .single();

    if (!integration) {
      return new Response(
        JSON.stringify({ error: "Bolna integration not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = integration.config as Record<string, string>;
    const bolnaApiKey = config.api_key || "";
    const bolnaAgentId = campaign.bolna_agent_id;

    if (!bolnaApiKey || !bolnaAgentId) {
      return new Response(
        JSON.stringify({ error: "Bolna API key or Agent ID missing" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch pending calls
    const { data: calls, error: callsErr } = await supabase
      .from("calling_agent_calls")
      .select("id, contact_name, contact_phone, context_details")
      .eq("campaign_id", campaign_id)
      .eq("status", "pending");

    if (callsErr || !calls || calls.length === 0) {
      return new Response(JSON.stringify({ error: "No pending calls found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build CSV for Bolna batch API
    // Extract all unique keys from context_details across all calls
    const contextKeys = new Set<string>();
    calls.forEach((c: any) => {
      if (c.context_details && typeof c.context_details === "object") {
        Object.keys(c.context_details).forEach((k) => contextKeys.add(k));
      }
    });
    const extraCols = Array.from(contextKeys);

    const csvHeader = ["contact_number", "call_id", ...extraCols].join(",");
    const csvRows = calls.map((c: any) => {
      const phone = c.contact_phone.startsWith("+") ? c.contact_phone : `+91${c.contact_phone}`;
      const extras = extraCols.map((k) => {
        const val = c.context_details?.[k] ?? "";
        const strVal = String(val);
        return strVal.includes(",") ? `"${strVal}"` : strVal;
      });
      return [phone, c.id, ...extras].join(",");
    });
    const csvContent = [csvHeader, ...csvRows].join("\n");

    console.log(`Starting calling agent campaign ${campaign_id}: ${calls.length} contacts`);

    // Create batch with Bolna
    const formData = new FormData();
    formData.append("agent_id", bolnaAgentId);
    formData.append("file", new Blob([csvContent], { type: "text/csv" }), "contacts.csv");

    const fromPhone = config.from_phone_number || "";
    if (fromPhone) {
      formData.append("from_phone_number", fromPhone);
    }

    const batchRes = await fetchWithRetry("https://api.bolna.ai/batches", {
      method: "POST",
      headers: { Authorization: `Bearer ${bolnaApiKey}` },
      body: formData,
    }, { timeoutMs: 15000, maxRetries: 2 });

    if (!batchRes.ok) {
      const errText = await batchRes.text();
      console.error("Bolna batch create failed:", batchRes.status, errText);
      await supabase.from("calling_agent_campaigns").update({
        status: "failed",
      }).eq("id", campaign_id);
      return new Response(
        JSON.stringify({ error: "Failed to create Bolna batch", details: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const batchData = await batchRes.json();
    const batchId = batchData.batch_id || batchData.id;
    console.log(`Bolna batch created: ${batchId}`);

    // Schedule batch
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const rawTime = campaign.scheduled_at || new Date(Date.now() + 150000).toISOString();
    const scheduleTime = rawTime.replace(/\.\d{3}Z$/, "+00:00").replace(/Z$/, "+00:00");

    const scheduleForm = new FormData();
    scheduleForm.append("scheduled_at", scheduleTime);
    scheduleForm.append("bypass_call_guardrails", "true");

    let scheduleRes: Response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      scheduleRes = await fetch(`https://api.bolna.ai/batches/${batchId}/schedule`, {
        method: "POST",
        headers: { Authorization: `Bearer ${bolnaApiKey}` },
        body: scheduleForm,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchErr) {
      console.error("Schedule fetch error:", fetchErr);
      await supabase.from("calling_agent_campaigns").update({
        status: "failed",
        bolna_batch_id: batchId,
      }).eq("id", campaign_id);
      return new Response(
        JSON.stringify({ error: "Batch created but schedule failed", details: String(fetchErr) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!scheduleRes.ok) {
      const scheduleText = await scheduleRes.text();
      console.error("Schedule failed:", scheduleRes.status, scheduleText);
      await supabase.from("calling_agent_campaigns").update({
        status: "failed",
        bolna_batch_id: batchId,
      }).eq("id", campaign_id);
      return new Response(
        JSON.stringify({ error: "Scheduling failed", details: scheduleText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update campaign
    await supabase.from("calling_agent_campaigns").update({
      status: "running",
      bolna_batch_id: batchId,
      started_at: new Date().toISOString(),
    }).eq("id", campaign_id);

    // Update calls to queued
    await supabase.from("calling_agent_calls").update({
      status: "queued",
    }).eq("campaign_id", campaign_id).eq("status", "pending");

    return new Response(JSON.stringify({ success: true, batch_id: batchId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("start-calling-agent-campaign error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
