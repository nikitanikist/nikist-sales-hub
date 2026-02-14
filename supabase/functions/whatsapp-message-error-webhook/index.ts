import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate
    const EXPECTED_API_KEY = Deno.env.get('WEBHOOK_SECRET_KEY');
    if (!EXPECTED_API_KEY) {
      console.error('WEBHOOK_SECRET_KEY environment variable not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const apiKey = req.headers.get("x-api-key") || req.headers.get("authorization")?.replace("Bearer ", "");
    if (apiKey !== EXPECTED_API_KEY) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { event, messageId, errorCode, errorMessage, groupJid } = body;

    console.log("Received message error webhook:", { event, messageId, errorCode, groupJid });

    if (event !== "message_error" || !messageId) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find the campaign group record by message_id
    const { data: campaignGroup, error: lookupError } = await supabase
      .from("notification_campaign_groups")
      .select("id, campaign_id, status")
      .eq("message_id", messageId)
      .maybeSingle();

    if (lookupError) {
      console.error("Lookup error:", lookupError);
      return new Response(JSON.stringify({ error: "Lookup failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!campaignGroup) {
      console.log("No campaign group found for messageId:", messageId);
      return new Response(JSON.stringify({ status: "not_found", messageId }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update campaign group status to failed
    const { error: updateError } = await supabase
      .from("notification_campaign_groups")
      .update({
        status: "failed",
        error_message: `Error ${errorCode}: ${errorMessage || "Async rejection"}`,
      })
      .eq("id", campaignGroup.id);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(JSON.stringify({ error: "Update failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Recount totals on the parent campaign
    const { data: groupStats, error: statsError } = await supabase
      .from("notification_campaign_groups")
      .select("status")
      .eq("campaign_id", campaignGroup.campaign_id);

    if (!statsError && groupStats) {
      const sentCount = groupStats.filter((g) => g.status === "sent").length;
      const failedCount = groupStats.filter((g) => g.status === "failed").length;
      const pendingCount = groupStats.filter((g) => g.status === "pending").length;
      const totalGroups = groupStats.length;

      let campaignStatus = "completed";
      if (pendingCount > 0) {
        campaignStatus = "sending";
      } else if (failedCount > 0 && sentCount > 0) {
        campaignStatus = "partial_failure";
      } else if (failedCount === totalGroups) {
        campaignStatus = "failed";
      }

      await supabase
        .from("notification_campaigns")
        .update({
          status: campaignStatus,
          sent_count: sentCount,
          failed_count: failedCount,
        })
        .eq("id", campaignGroup.campaign_id);

      console.log(`Updated campaign ${campaignGroup.campaign_id}: status=${campaignStatus}, sent=${sentCount}, failed=${failedCount}`);
    }

    return new Response(
      JSON.stringify({ status: "updated", campaignGroupId: campaignGroup.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
