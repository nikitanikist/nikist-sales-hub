import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

interface ReceiptPayload {
  event: "read" | "delivered";
  sessionId: string;
  messageId: string;
  groupJid: string;
  readerPhone: string;
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

    const payload: ReceiptPayload = await req.json();
    console.log("Receipt received:", JSON.stringify(payload));

    // Validate event type
    if (payload.event !== "read" && payload.event !== "delivered") {
      return new Response(
        JSON.stringify({ error: "Invalid event type, expected 'read' or 'delivered'" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!payload.messageId) {
      return new Response(
        JSON.stringify({ error: "Missing messageId" }),
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
        .select("id")
        .eq("message_id", payload.messageId)
        .single();

      if (webinarMsg) {
        const field = payload.event === "delivered" ? "delivered_count" : "read_count";
        const { data: current } = await supabase
          .from("scheduled_webinar_messages")
          .select(field)
          .eq("id", webinarMsg.id)
          .single();
        
        await supabase
          .from("scheduled_webinar_messages")
          .update({ [field]: ((current as any)?.[field] || 0) + 1 })
          .eq("id", webinarMsg.id);
        
        console.log(`Webinar ${payload.event} receipt for msg ${webinarMsg.id}`);
        return new Response(
          JSON.stringify({ success: true, target: "webinar", receipt_type: payload.event }),
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

    // DELIVERED events: deduplicate via upsert, then recount
    if (payload.event === "delivered") {
      if (!payload.readerPhone) {
        console.log("Skipped delivered event: no readerPhone for deduplication");
        return new Response(
          JSON.stringify({ message: "Skipped: no readerPhone for delivered" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Upsert (deduplicated by unique constraint on campaign_group_id, reader_phone, receipt_type)
      const { error: upsertError } = await supabase
        .from("notification_campaign_reads")
        .upsert(
          {
            campaign_group_id: campaignGroup.id,
            reader_phone: payload.readerPhone,
            read_at: payload.timestamp || new Date().toISOString(),
            receipt_type: "delivered",
          },
          { onConflict: "campaign_group_id,reader_phone,receipt_type" }
        );

      if (upsertError) {
        console.error("Error upserting delivered receipt:", upsertError);
        return new Response(
          JSON.stringify({ error: upsertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Recount for accuracy
      const { count } = await supabase
        .from("notification_campaign_reads")
        .select("*", { count: "exact", head: true })
        .eq("campaign_group_id", campaignGroup.id)
        .eq("receipt_type", "delivered");

      await supabase
        .from("notification_campaign_groups")
        .update({ delivered_count: count || 0 })
        .eq("id", campaignGroup.id);

      console.log(`Delivered receipt recorded for group ${campaignGroup.id}, reader: ${payload.readerPhone}, count: ${count}`);
      return new Response(
        JSON.stringify({ success: true, receipt_type: "delivered", count }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // READ events: require readerPhone, upsert reads row, then increment read_count
    if (!payload.readerPhone) {
      return new Response(
        JSON.stringify({ error: "Missing readerPhone for read event" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert receipt (deduplicated by unique constraint)
    const { error: insertError } = await supabase
      .from("notification_campaign_reads")
      .upsert(
        {
          campaign_group_id: campaignGroup.id,
          reader_phone: payload.readerPhone,
          read_at: payload.timestamp || new Date().toISOString(),
          receipt_type: "read",
        },
        { onConflict: "campaign_group_id,reader_phone,receipt_type" }
      );

    if (insertError) {
      console.error("Error inserting read receipt:", insertError);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Recount reads from table for accuracy
    const { count: readCount } = await supabase
      .from("notification_campaign_reads")
      .select("*", { count: "exact", head: true })
      .eq("campaign_group_id", campaignGroup.id)
      .eq("receipt_type", "read");

    await supabase
      .from("notification_campaign_groups")
      .update({ read_count: readCount || 0 })
      .eq("id", campaignGroup.id);

    console.log(`Read receipt recorded for group ${campaignGroup.id}, reader: ${payload.readerPhone}, count: ${readCount}`);
    return new Response(
      JSON.stringify({ success: true, receipt_type: "read", count: readCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Receipt webhook error:", err);
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
