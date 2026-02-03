import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

interface WebhookPayload {
  event: "join" | "leave";
  sessionId: string;
  groupJid: string;
  participant: {
    phone: string;
    id?: string;
  };
  timestamp?: string;
}

// Normalize phone number to last 10 digits
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-10);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate API key
    const apiKey = req.headers.get("x-api-key");
    const expectedKey = Deno.env.get("WHATSAPP_VPS_API_KEY");

    if (!apiKey || apiKey !== expectedKey) {
      console.error("Unauthorized: Invalid or missing API key");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const payload: WebhookPayload = await req.json();
    console.log("Received webhook payload:", JSON.stringify(payload));

    // Validate payload
    if (!payload.event || !payload.sessionId || !payload.groupJid || !payload.participant?.phone) {
      console.error("Invalid payload:", payload);
      return new Response(
        JSON.stringify({ error: "Invalid payload: missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up the session to get organization_id
    const { data: session, error: sessionError } = await supabase
      .from("whatsapp_sessions")
      .select("id, organization_id")
      .or(`id.eq.${payload.sessionId},metadata->vps_session_id.eq.${payload.sessionId}`)
      .single();

    if (sessionError || !session) {
      // Try to find by checking the metadata jsonb field more directly
      const { data: sessions, error: sessionsError } = await supabase
        .from("whatsapp_sessions")
        .select("id, organization_id, metadata");

      if (sessionsError) {
        console.error("Error fetching sessions:", sessionsError);
        return new Response(
          JSON.stringify({ error: "Session lookup failed" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Find session by matching vps_session_id in metadata
      const matchedSession = sessions?.find((s) => {
        const vpsSessionId = s.metadata?.vps_session_id;
        return vpsSessionId === payload.sessionId || s.id === payload.sessionId;
      });

      if (!matchedSession) {
        console.error("Session not found for:", payload.sessionId);
        return new Response(
          JSON.stringify({ error: "Session not found", sessionId: payload.sessionId }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Use matched session
      const organizationId = matchedSession.organization_id;
      const normalizedPhone = normalizePhone(payload.participant.phone);
      const eventTime = payload.timestamp ? new Date(payload.timestamp) : new Date();

      // Look up the group by JID
      const { data: group } = await supabase
        .from("whatsapp_groups")
        .select("id")
        .eq("group_jid", payload.groupJid)
        .single();

      if (payload.event === "join") {
        // Upsert member with active status
        const { error: upsertError } = await supabase
          .from("workshop_group_members")
          .upsert(
            {
              organization_id: organizationId,
              group_id: group?.id || null,
              group_jid: payload.groupJid,
              phone_number: normalizedPhone,
              full_phone: payload.participant.phone,
              participant_jid: payload.participant.id || null,
              status: "active",
              joined_at: eventTime.toISOString(),
              left_at: null,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "group_jid,phone_number",
              ignoreDuplicates: false,
            }
          );

        if (upsertError) {
          console.error("Error upserting member:", upsertError);
          return new Response(
            JSON.stringify({ error: "Failed to record join event", details: upsertError.message }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        console.log(`Member joined: ${normalizedPhone} in group ${payload.groupJid}`);
      } else if (payload.event === "leave") {
        // Update member to left status
        const { error: updateError } = await supabase
          .from("workshop_group_members")
          .update({
            status: "left",
            left_at: eventTime.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("group_jid", payload.groupJid)
          .eq("phone_number", normalizedPhone);

        if (updateError) {
          console.error("Error updating member:", updateError);
          return new Response(
            JSON.stringify({ error: "Failed to record leave event", details: updateError.message }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        console.log(`Member left: ${normalizedPhone} from group ${payload.groupJid}`);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          event: payload.event,
          phone: normalizedPhone,
          groupJid: payload.groupJid 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Use the found session directly
    const organizationId = session.organization_id;
    const normalizedPhone = normalizePhone(payload.participant.phone);
    const eventTime = payload.timestamp ? new Date(payload.timestamp) : new Date();

    // Look up the group by JID
    const { data: group } = await supabase
      .from("whatsapp_groups")
      .select("id")
      .eq("group_jid", payload.groupJid)
      .single();

    if (payload.event === "join") {
      // Upsert member with active status
      const { error: upsertError } = await supabase
        .from("workshop_group_members")
        .upsert(
          {
            organization_id: organizationId,
            group_id: group?.id || null,
            group_jid: payload.groupJid,
            phone_number: normalizedPhone,
            full_phone: payload.participant.phone,
            participant_jid: payload.participant.id || null,
            status: "active",
            joined_at: eventTime.toISOString(),
            left_at: null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "group_jid,phone_number",
            ignoreDuplicates: false,
          }
        );

      if (upsertError) {
        console.error("Error upserting member:", upsertError);
        return new Response(
          JSON.stringify({ error: "Failed to record join event", details: upsertError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log(`Member joined: ${normalizedPhone} in group ${payload.groupJid}`);
    } else if (payload.event === "leave") {
      // Update member to left status
      const { error: updateError } = await supabase
        .from("workshop_group_members")
        .update({
          status: "left",
          left_at: eventTime.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("group_jid", payload.groupJid)
        .eq("phone_number", normalizedPhone);

      if (updateError) {
        console.error("Error updating member:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to record leave event", details: updateError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log(`Member left: ${normalizedPhone} from group ${payload.groupJid}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        event: payload.event,
        phone: normalizedPhone,
        groupJid: payload.groupJid 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
