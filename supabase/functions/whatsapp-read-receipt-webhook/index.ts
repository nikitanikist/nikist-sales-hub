import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

const EXPECTED_API_KEY = "nikist-whatsapp-2024-secure-key";

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
      console.log("No campaign group found for messageId:", payload.messageId);
      return new Response(
        JSON.stringify({ message: "No matching campaign group" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // DELIVERED events: always increment delivered_count atomically
    if (payload.event === "delivered") {
      const { data: newCount, error: rpcError } = await supabase.rpc(
        "increment_delivered_count",
        { p_group_id: campaignGroup.id }
      );

      if (rpcError) {
        console.error("Error incrementing delivered count:", rpcError);
        return new Response(
          JSON.stringify({ error: rpcError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Delivered count incremented for group ${campaignGroup.id}, new count: ${newCount}`);
      return new Response(
        JSON.stringify({ success: true, receipt_type: "delivered", count: newCount }),
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

    // Atomically increment read_count (capped at member_count)
    const { data: readCount, error: readRpcError } = await supabase.rpc(
      "increment_read_count",
      { p_group_id: campaignGroup.id }
    );

    if (readRpcError) {
      console.error("Error incrementing read count:", readRpcError);
    }

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
