import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  appointment_id: string;
}

// Helper function to format time in 12-hour format
function formatTime12Hour(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// Helper function to format date
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  return `${date.getDate()} ${months[date.getMonth()]}`;
}

// Extract first name from full name
function getFirstName(fullName: string): string {
  return fullName.split(' ')[0];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const aiSensyApiKey = Deno.env.get("AISENSY_API_KEY")!;
    const aiSensySource = Deno.env.get("AISENSY_SOURCE")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { appointment_id }: NotificationRequest = await req.json();

    if (!appointment_id) {
      console.error("Missing appointment_id in request");
      return new Response(
        JSON.stringify({ error: "appointment_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fetching appointment details for: ${appointment_id}`);

    // Fetch appointment with lead and closer details
    const { data: appointment, error: aptError } = await supabase
      .from("call_appointments")
      .select(`
        id,
        scheduled_date,
        scheduled_time,
        lead_id,
        closer_id
      `)
      .eq("id", appointment_id)
      .single();

    if (aptError || !appointment) {
      console.error("Error fetching appointment:", aptError);
      return new Response(
        JSON.stringify({ error: "Appointment not found", details: aptError }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch lead details
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("contact_name")
      .eq("id", appointment.lead_id)
      .single();

    if (leadError || !lead) {
      console.error("Error fetching lead:", leadError);
      return new Response(
        JSON.stringify({ error: "Lead not found", details: leadError }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch closer details (including phone from profiles)
    const { data: closer, error: closerError } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", appointment.closer_id)
      .single();

    if (closerError || !closer) {
      console.error("Error fetching closer:", closerError);
      return new Response(
        JSON.stringify({ error: "Closer not found", details: closerError }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if closer has phone number
    if (!closer.phone) {
      console.log(`Closer ${closer.full_name} does not have a phone number configured. Skipping notification.`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Closer does not have phone number, notification skipped",
          closer_name: closer.full_name
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean phone number (remove + and any spaces)
    const cleanPhone = closer.phone.replace(/[\s+]/g, '');
    
    // Prepare template variables
    const closerFirstName = getFirstName(closer.full_name);
    const leadName = lead.contact_name;
    const meetingDate = formatDate(appointment.scheduled_date);
    const meetingTime = formatTime12Hour(appointment.scheduled_time);

    console.log(`Sending notification to ${closer.full_name} (${cleanPhone})`);
    console.log(`Template variables: ${closerFirstName}, ${leadName}, ${meetingDate}, ${meetingTime}`);

    // Send WhatsApp notification via AiSensy
    const aiSensyPayload = {
      apiKey: aiSensyApiKey,
      campaignName: "1_to_1_call_booking",
      destination: cleanPhone,
      userName: closerFirstName,
      source: aiSensySource,
      templateParams: [
        closerFirstName,  // {{1}} - Closer's first name
        leadName,         // {{2}} - Lead's name
        meetingDate,      // {{3}} - Meeting date (e.g., "27 December")
        meetingTime       // {{4}} - Meeting time (e.g., "7:30 PM")
      ]
    };

    console.log("Sending AiSensy request:", JSON.stringify(aiSensyPayload, null, 2));

    const aiSensyResponse = await fetch("https://backend.aisensy.com/campaign/t1/api/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(aiSensyPayload),
    });

    const aiSensyResult = await aiSensyResponse.json();
    console.log("AiSensy response:", JSON.stringify(aiSensyResult, null, 2));

    if (!aiSensyResponse.ok) {
      console.error("AiSensy API error:", aiSensyResult);
      return new Response(
        JSON.stringify({ 
          error: "Failed to send WhatsApp notification",
          details: aiSensyResult 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Successfully sent notification to ${closer.full_name} for call with ${leadName}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Closer notification sent successfully",
        closer_name: closer.full_name,
        closer_phone: cleanPhone,
        lead_name: leadName,
        scheduled_date: meetingDate,
        scheduled_time: meetingTime,
        aisensy_response: aiSensyResult
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in send-closer-notification:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
