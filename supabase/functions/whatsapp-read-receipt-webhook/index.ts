import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

const EXPECTED_API_KEY = "nikist-whatsapp-2024-secure-key";

interface ReadReceiptPayload {
  event: "read";
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

    const payload: ReadReceiptPayload = await req.json();
    console.log("Read receipt received:", JSON.stringify(payload));

    if (!payload.messageId || !payload.readerPhone) {
      return new Response(
        JSON.stringify({ error: "Missing messageId or readerPhone" }),
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

    // Upsert read receipt (deduplicated by unique constraint)
    const { error: insertError } = await supabase
      .from("notification_campaign_reads")
      .upsert(
        {
          campaign_group_id: campaignGroup.id,
          reader_phone: payload.readerPhone,
          read_at: payload.timestamp || new Date().toISOString(),
        },
        { onConflict: "campaign_group_id,reader_phone" }
      );

    if (insertError) {
      console.error("Error inserting read receipt:", insertError);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update the denormalized read_count
    const { count } = await supabase
      .from("notification_campaign_reads")
      .select("*", { count: "exact", head: true })
      .eq("campaign_group_id", campaignGroup.id);

    await supabase
      .from("notification_campaign_groups")
      .update({ read_count: count || 0 })
      .eq("id", campaignGroup.id);

    console.log(
      `Read receipt recorded for group ${campaignGroup.id}, total reads: ${count}`
    );

    return new Response(
      JSON.stringify({ success: true, read_count: count }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Read receipt webhook error:", err);
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
