import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");

    if (!slug) {
      return new Response(JSON.stringify({ error: "missing_slug" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Call the existing increment_link_click RPC function
    const { data, error } = await supabase.rpc("increment_link_click", {
      link_slug: slug,
    });

    if (error) {
      console.error("RPC error:", error);
      return new Response(JSON.stringify({ error: "database_error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!data || data.length === 0) {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = data[0];
    
    // If we have a destination URL or invite link, return it immediately
    if (result.destination_url || result.invite_link) {
      const destinationUrl = result.destination_url || result.invite_link;
      return new Response(JSON.stringify({ url: destinationUrl }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If we have a WhatsApp group ID but no invite link, try to fetch it from VPS
    if (result.whatsapp_group_id) {
      console.log(`Invite link missing for group ${result.whatsapp_group_id}, attempting VPS fetch...`);
      
      // Fetch group details
      const { data: group, error: groupError } = await supabase
        .from("whatsapp_groups")
        .select("session_id, group_jid")
        .eq("id", result.whatsapp_group_id)
        .maybeSingle();

      if (groupError) {
        console.error("Error fetching group:", groupError);
      }

      if (group && group.session_id && group.group_jid) {
        // Get session's VPS session ID
        const { data: session, error: sessionError } = await supabase
          .from("whatsapp_sessions")
          .select("vps_session_id")
          .eq("id", group.session_id)
          .eq("status", "connected")
          .maybeSingle();

        if (sessionError) {
          console.error("Error fetching session:", sessionError);
        }

        if (session?.vps_session_id) {
          const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
          const vpsApiKey = Deno.env.get("WHATSAPP_VPS_API_KEY");

          if (vpsUrl && vpsApiKey) {
            try {
              // Fetch invite link from VPS with timeout
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

              const vpsResponse = await fetch(
                `${vpsUrl}/groups/${session.vps_session_id}/${group.group_jid}/invite`,
                {
                  headers: { "X-API-Key": vpsApiKey },
                  signal: controller.signal,
                }
              );

              clearTimeout(timeoutId);

              if (vpsResponse.ok) {
                const vpsData = await vpsResponse.json();

                if (vpsData.inviteLink) {
                  console.log(`Successfully fetched invite link for group ${result.whatsapp_group_id}`);
                  
                  // Save to database for future use (fire and forget)
                  supabase
                    .from("whatsapp_groups")
                    .update({ invite_link: vpsData.inviteLink })
                    .eq("id", result.whatsapp_group_id)
                    .then(({ error: updateError }) => {
                      if (updateError) {
                        console.error("Error updating invite link:", updateError);
                      }
                    });

                  // Return the invite link
                  return new Response(JSON.stringify({ url: vpsData.inviteLink }), {
                    status: 200,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                  });
                }
              } else {
                const errorText = await vpsResponse.text();
                console.error(`VPS error (${vpsResponse.status}):`, errorText);
              }
            } catch (vpsError) {
              if (vpsError instanceof Error && vpsError.name === "AbortError") {
                console.error("VPS request timed out");
              } else {
                console.error("VPS fetch error:", vpsError);
              }
            }
          } else {
            console.error("VPS credentials not configured");
          }
        }
      }
    }

    // No destination found
    return new Response(JSON.stringify({ error: "no_destination" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "server_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
