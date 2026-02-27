import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Validate webhook secret
    const expectedSecret = Deno.env.get("BOLNA_WH_LINK_SECRET");
    if (!expectedSecret || body.webhook_secret !== expectedSecret) {
      console.error("Unauthorized: invalid or missing webhook_secret");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize logs
    const { webhook_secret, ...safeBody } = body;
    console.log("Reschedule request from Bolna:", JSON.stringify(safeBody));

    const phoneNumber = body.phone_number || body.whatsapp_number;
    const rescheduleDay = body.reschedule_day;

    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ error: "No phone_number provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!rescheduleDay) {
      return new Response(
        JSON.stringify({ error: "No reschedule_day provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build phone number variants for matching
    const cleaned = phoneNumber.replace(/\+/g, "").replace(/^0+/, "");
    const with91 = cleaned.startsWith("91") ? cleaned : `91${cleaned}`;
    const without91 = cleaned.startsWith("91") ? cleaned.slice(2) : cleaned;
    const withPlus91 = `+${with91}`;
    const variants = [cleaned, with91, without91, withPlus91];

    console.log(`Looking for call with phone variants: ${variants.join(", ")}, reschedule_day: ${rescheduleDay}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const terminalStatuses = ["completed", "no-answer", "busy", "failed", "cancelled"];

    // Try each phone variant to find a matching active call
    let matchedCall = null;
    for (const variant of variants) {
      const { data, error } = await supabase
        .from("voice_campaign_calls")
        .select("id, campaign_id, phone_number, status, outcome")
        .eq("phone_number", variant)
        .not("status", "in", `(${terminalStatuses.join(",")})`)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        console.error(`Query error for variant ${variant}:`, error.message);
        continue;
      }

      if (data && data.length > 0) {
        matchedCall = data[0];
        console.log(`Matched call ${matchedCall.id} with variant: ${variant}`);
        break;
      }
    }

    if (!matchedCall) {
      console.warn(`No active call found for phone: ${phoneNumber}`);
      return new Response(
        JSON.stringify({ error: "No active call found for this phone number", phone: phoneNumber }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the call with reschedule outcome
    const { error: updateError } = await supabase
      .from("voice_campaign_calls")
      .update({
        outcome: "rescheduled",
        reschedule_day: rescheduleDay,
        updated_at: new Date().toISOString(),
      })
      .eq("id", matchedCall.id);

    if (updateError) {
      console.error("Failed to update call:", updateError.message);
      return new Response(
        JSON.stringify({ error: "Failed to update call record", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Call ${matchedCall.id} updated: outcome=rescheduled, reschedule_day=${rescheduleDay}`);

    return new Response(
      JSON.stringify({
        success: true,
        call_id: matchedCall.id,
        campaign_id: matchedCall.campaign_id,
        outcome: "rescheduled",
        reschedule_day: rescheduleDay,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in reschedule-lead:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
