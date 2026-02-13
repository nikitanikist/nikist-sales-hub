import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

const EXPECTED_API_KEY = "nikist-whatsapp-2024-secure-key";

interface ReactionPayload {
  event: "reaction_add";
  sessionId: string;
  messageId: string;
  groupJid: string;
  reactorPhone: string;
  emoji: string;
  timestamp: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate API key
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

    if (!payload.messageId || !payload.reactorPhone || !payload.emoji) {
      return new Response(
        JSON.stringify({
          error: "Missing messageId, reactorPhone, or emoji",
        }),
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
      console.log(
        "No campaign group found for messageId:",
        payload.messageId
      );
      return new Response(
        JSON.stringify({ message: "No matching campaign group" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Upsert reaction (deduplicated by unique constraint)
    const { error: insertError } = await supabase
      .from("notification_campaign_reactions")
      .upsert(
        {
          campaign_group_id: campaignGroup.id,
          reactor_phone: payload.reactorPhone,
          emoji: payload.emoji,
          reacted_at: payload.timestamp || new Date().toISOString(),
        },
        { onConflict: "campaign_group_id,reactor_phone,emoji" }
      );

    if (insertError) {
      console.error("Error inserting reaction:", insertError);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update the denormalized reaction_count
    const { count } = await supabase
      .from("notification_campaign_reactions")
      .select("*", { count: "exact", head: true })
      .eq("campaign_group_id", campaignGroup.id);

    await supabase
      .from("notification_campaign_groups")
      .update({ reaction_count: count || 0 })
      .eq("id", campaignGroup.id);

    console.log(
      `Reaction recorded for group ${campaignGroup.id}, emoji: ${payload.emoji}, total reactions: ${count}`
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
