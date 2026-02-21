import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

interface ReactionPayload {
  event: "reaction_add" | "reaction_remove";
  sessionId: string;
  messageId: string;
  groupJid: string;
  reactorPhone: string;
  emoji?: string;
  timestamp: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const EXPECTED_API_KEY = Deno.env.get('WEBHOOK_SECRET_KEY');
    if (!EXPECTED_API_KEY) {
      console.error('WEBHOOK_SECRET_KEY environment variable not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const apiKey =
      req.headers.get("x-api-key") ||
      req.headers.get("authorization")?.replace("Bearer ", "");

    if (apiKey !== EXPECTED_API_KEY) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: ReactionPayload = await req.json();
    console.log("Reaction received:", JSON.stringify(payload));

    if (!payload.messageId || !payload.reactorPhone) {
      return new Response(
        JSON.stringify({ error: "Missing messageId or reactorPhone" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (payload.event === "reaction_add" && !payload.emoji) {
      return new Response(
        JSON.stringify({ error: "Missing emoji for reaction_add" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find the campaign group by message_id
    const { data: campaignGroup, error: findError } = await supabase
      .from("notification_campaign_groups")
      .select("id")
      .eq("message_id", payload.messageId)
      .single();

    if (findError || !campaignGroup) {
      // Fallback: check scheduled_webinar_messages
      const { data: webinarMsg } = await supabase
        .from("scheduled_webinar_messages")
        .select("id, reaction_count")
        .eq("message_id", payload.messageId)
        .single();

      if (webinarMsg) {
        const newCount = payload.event === "reaction_add"
          ? (webinarMsg.reaction_count || 0) + 1
          : Math.max((webinarMsg.reaction_count || 0) - 1, 0);
        
        await supabase
          .from("scheduled_webinar_messages")
          .update({ reaction_count: newCount })
          .eq("id", webinarMsg.id);
        
        console.log(`Webinar reaction ${payload.event} for msg ${webinarMsg.id}, total: ${newCount}`);
        return new Response(
          JSON.stringify({ success: true, target: "webinar", reaction_count: newCount }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("No campaign group or webinar msg found for messageId:", payload.messageId);
      return new Response(
        JSON.stringify({ message: "No matching campaign group" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (payload.event === "reaction_remove") {
      // Delete the reaction row
      const { error: deleteError } = await supabase
        .from("notification_campaign_reactions")
        .delete()
        .eq("campaign_group_id", campaignGroup.id)
        .eq("reactor_phone", payload.reactorPhone);

      if (deleteError) {
        console.error("Error deleting reaction:", deleteError);
      }
    } else {
      // reaction_add: UPSERT (one reaction per person per group)
      const { error: upsertError } = await supabase
        .from("notification_campaign_reactions")
        .upsert(
          {
            campaign_group_id: campaignGroup.id,
            reactor_phone: payload.reactorPhone,
            emoji: payload.emoji!,
            reacted_at: payload.timestamp || new Date().toISOString(),
          },
          { onConflict: "campaign_group_id,reactor_phone" }
        );

      if (upsertError) {
        console.error("Error upserting reaction:", upsertError);
        return new Response(
          JSON.stringify({ error: upsertError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Recount reactions from table
    const { count } = await supabase
      .from("notification_campaign_reactions")
      .select("*", { count: "exact", head: true })
      .eq("campaign_group_id", campaignGroup.id);

    await supabase
      .from("notification_campaign_groups")
      .update({ reaction_count: count || 0 })
      .eq("id", campaignGroup.id);

    console.log(
      `Reaction ${payload.event} for group ${campaignGroup.id}, reactor: ${payload.reactorPhone}, total: ${count}`
    );

    return new Response(
      JSON.stringify({ success: true, reaction_count: count }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Reaction webhook error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
