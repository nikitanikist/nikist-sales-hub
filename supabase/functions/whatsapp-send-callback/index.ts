import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate via X-API-Key
    const apiKey = req.headers.get("X-API-Key") || req.headers.get("x-api-key");
    const webhookSecret = Deno.env.get("WEBHOOK_SECRET_KEY");

    if (!apiKey || apiKey !== webhookSecret) {
      console.error("Unauthorized: invalid or missing API key");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { event, sessionId, groupJid, messageId, status, error: errorMsg, timestamp } = body;

    console.log(`Callback received: event=${event}, groupJid=${groupJid}, messageId=${messageId}`);

    if (!groupJid || !event) {
      return new Response(JSON.stringify({ error: "Missing required fields: event, groupJid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find the most recent campaign group matching this groupJid in "processing" status
    const { data: group, error: lookupError } = await supabase
      .from("notification_campaign_groups")
      .select("id, campaign_id")
      .eq("group_jid", groupJid)
      .eq("status", "processing")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      console.error("Lookup error:", lookupError);
      return new Response(JSON.stringify({ error: "Database lookup failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!group) {
      // No matching processing group — might have already been updated or stale-recovered
      console.log(`No processing group found for groupJid=${groupJid}, ignoring callback`);
      return new Response(JSON.stringify({ ok: true, matched: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update the group based on event type
    if (event === "message_sent") {
      const sentAt = timestamp
        ? new Date(timestamp).toISOString()
        : new Date().toISOString();

      await supabase
        .from("notification_campaign_groups")
        .update({
          status: "sent",
          message_id: messageId || null,
          sent_at: sentAt,
          error_message: null,
          processing_started_at: null,
        })
        .eq("id", group.id);

      console.log(`Group ${group.id} marked as sent with messageId=${messageId}`);
    } else if (event === "message_failed") {
      await supabase
        .from("notification_campaign_groups")
        .update({
          status: "failed",
          error_message: errorMsg || "Send failed (VPS callback)",
          processing_started_at: null,
        })
        .eq("id", group.id);

      console.log(`Group ${group.id} marked as failed: ${errorMsg}`);
    } else {
      console.log(`Unknown event type: ${event}, ignoring`);
      return new Response(JSON.stringify({ ok: true, matched: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if all groups for this campaign are done (no pending or processing remaining)
    const campaignId = group.campaign_id;

    const { count: remainingCount } = await supabase
      .from("notification_campaign_groups")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .in("status", ["pending", "processing"]);

    if (remainingCount === 0) {
      // All groups are done — finalize campaign
      const { count: sentCount } = await supabase
        .from("notification_campaign_groups")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .eq("status", "sent");

      const { count: failedCount } = await supabase
        .from("notification_campaign_groups")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .eq("status", "failed");

      const finalSent = sentCount || 0;
      const finalFailed = failedCount || 0;

      const finalStatus = finalFailed > 0 && finalSent > 0
        ? "partial_failure"
        : finalFailed > 0
        ? "failed"
        : "completed";

      await supabase
        .from("notification_campaigns")
        .update({
          status: finalStatus,
          completed_at: new Date().toISOString(),
          sent_count: finalSent,
          failed_count: finalFailed,
          processing_by: null,
          processing_started_at: null,
        })
        .eq("id", campaignId);

      console.log(`Campaign ${campaignId} finalized: status=${finalStatus}, sent=${finalSent}, failed=${finalFailed}`);
    } else {
      // Update running counts but don't finalize
      const { count: sentCount } = await supabase
        .from("notification_campaign_groups")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .eq("status", "sent");

      const { count: failedCount } = await supabase
        .from("notification_campaign_groups")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .eq("status", "failed");

      await supabase
        .from("notification_campaigns")
        .update({
          sent_count: sentCount || 0,
          failed_count: failedCount || 0,
        })
        .eq("id", campaignId);
    }

    return new Response(JSON.stringify({ ok: true, matched: true, groupId: group.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
