import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find campaigns that need processing
    const { data: campaigns, error: fetchError } = await supabase
      .from("notification_campaigns")
      .select("*")
      .or(
        `status.eq.sending,and(status.eq.scheduled,scheduled_for.lte.${new Date().toISOString()})`
      )
      .limit(5);

    if (fetchError) {
      console.error("Error fetching campaigns:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!campaigns || campaigns.length === 0) {
      return new Response(JSON.stringify({ message: "No campaigns to process" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Record<string, { sent: number; failed: number }> = {};

    for (const campaign of campaigns) {
      // If scheduled, move to sending
      if (campaign.status === "scheduled") {
        await supabase
          .from("notification_campaigns")
          .update({ status: "sending", started_at: new Date().toISOString() })
          .eq("id", campaign.id);
      } else if (!campaign.started_at) {
        await supabase
          .from("notification_campaigns")
          .update({ started_at: new Date().toISOString() })
          .eq("id", campaign.id);
      }

      // Get session's VPS session ID
      const { data: sessionData } = await supabase
        .from("whatsapp_sessions")
        .select("session_data, status")
        .eq("id", campaign.session_id)
        .single();

      if (!sessionData || sessionData.status !== "connected") {
        // Session disconnected — mark remaining groups as failed
        await supabase
          .from("notification_campaign_groups")
          .update({
            status: "failed",
            error_message: "WhatsApp session disconnected",
          })
          .eq("campaign_id", campaign.id)
          .eq("status", "pending");

        const { count: failedCount } = await supabase
          .from("notification_campaign_groups")
          .select("*", { count: "exact", head: true })
          .eq("campaign_id", campaign.id)
          .eq("status", "failed");

        const { count: sentCount } = await supabase
          .from("notification_campaign_groups")
          .select("*", { count: "exact", head: true })
          .eq("campaign_id", campaign.id)
          .eq("status", "sent");

        await supabase
          .from("notification_campaigns")
          .update({
            status: sentCount && sentCount > 0 ? "partial_failure" : "failed",
            completed_at: new Date().toISOString(),
            sent_count: sentCount || 0,
            failed_count: failedCount || 0,
          })
          .eq("id", campaign.id);

        results[campaign.id] = { sent: 0, failed: failedCount || 0 };
        continue;
      }

      const vpsSessionId =
        (sessionData.session_data as any)?.vps_session_id || campaign.session_id;

      // Get next batch of pending groups
      const { data: pendingGroups } = await supabase
        .from("notification_campaign_groups")
        .select("*")
        .eq("campaign_id", campaign.id)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(BATCH_SIZE);

      if (!pendingGroups || pendingGroups.length === 0) {
        // No more pending — finalize
        const { count: sentCount } = await supabase
          .from("notification_campaign_groups")
          .select("*", { count: "exact", head: true })
          .eq("campaign_id", campaign.id)
          .eq("status", "sent");

        const { count: failedCount } = await supabase
          .from("notification_campaign_groups")
          .select("*", { count: "exact", head: true })
          .eq("campaign_id", campaign.id)
          .eq("status", "failed");

        const finalStatus =
          failedCount && failedCount > 0 ? "partial_failure" : "completed";

        await supabase
          .from("notification_campaigns")
          .update({
            status: finalStatus,
            completed_at: new Date().toISOString(),
            sent_count: sentCount || 0,
            failed_count: failedCount || 0,
          })
          .eq("id", campaign.id);

        results[campaign.id] = {
          sent: sentCount || 0,
          failed: failedCount || 0,
        };
        continue;
      }

      // Process batch
      const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL")!;
      const vpsApiKey = Deno.env.get("WHATSAPP_VPS_API_KEY")!;
      let batchSent = 0;
      let batchFailed = 0;

      for (let i = 0; i < pendingGroups.length; i++) {
        const group = pendingGroups[i];

        try {
          const sendBody: Record<string, unknown> = {
            sessionId: vpsSessionId,
            phone: group.group_jid,
            message: campaign.message_content,
          };

          if (campaign.media_url) {
            sendBody.mediaUrl = campaign.media_url;
            sendBody.mediaType = campaign.media_type || "document";
          }

          const sendResp = await fetch(`${vpsUrl}/send`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": vpsApiKey,
            },
            body: JSON.stringify(sendBody),
          });

          const sendData = await sendResp.json();

          if (sendData.success) {
            await supabase
              .from("notification_campaign_groups")
              .update({
                status: "sent",
                sent_at: new Date().toISOString(),
                message_id: sendData.messageId || null,
              })
              .eq("id", group.id);
            batchSent++;
          } else {
            await supabase
              .from("notification_campaign_groups")
              .update({
                status: "failed",
                error_message: sendData.error || "Send failed",
              })
              .eq("id", group.id);
            batchFailed++;
          }
        } catch (err) {
          await supabase
            .from("notification_campaign_groups")
            .update({
              status: "failed",
              error_message: err instanceof Error ? err.message : "Unknown error",
            })
            .eq("id", group.id);
          batchFailed++;
        }

        // Delay between sends (skip after last one)
        if (i < pendingGroups.length - 1 && campaign.delay_seconds > 0) {
          await new Promise((r) =>
            setTimeout(r, campaign.delay_seconds * 1000)
          );
        }
      }

      // Update running counts
      await supabase.rpc("update_campaign_counts", { p_campaign_id: campaign.id }).catch(() => {
        // Fallback: manual count update
        supabase
          .from("notification_campaigns")
          .update({
            sent_count: (campaign.sent_count || 0) + batchSent,
            failed_count: (campaign.failed_count || 0) + batchFailed,
          })
          .eq("id", campaign.id);
      });

      results[campaign.id] = { sent: batchSent, failed: batchFailed };
    }

    return new Response(JSON.stringify({ processed: Object.keys(results).length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Campaign processor error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
