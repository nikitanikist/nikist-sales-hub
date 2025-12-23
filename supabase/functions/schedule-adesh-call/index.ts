import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Adesh's configuration
const ADESH_EMAIL = "aadeshnikist@gmail.com";
const VIDEO_URL = 'https://d3jt6ku4g6z5l8.cloudfront.net/VIDEO/66f4f03f444c5c0b8013168b/5384969_1706706new video 1 14.mp4';

// Get Zoom access token using Server-to-Server OAuth
async function getZoomAccessToken(): Promise<string> {
  const accountId = Deno.env.get('ZOOM_ADESH_ACCOUNT_ID');
  const clientId = Deno.env.get('ZOOM_ADESH_CLIENT_ID');
  const clientSecret = Deno.env.get('ZOOM_ADESH_CLIENT_SECRET');

  if (!accountId || !clientId || !clientSecret) {
    throw new Error('Missing Zoom credentials');
  }

  console.log('Getting Zoom access token for Adesh...');

  const authHeader = btoa(`${clientId}:${clientSecret}`);
  
  const tokenResponse = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=account_credentials&account_id=${accountId}`,
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('Zoom token error:', errorText);
    throw new Error(`Failed to get Zoom access token: ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  console.log('Zoom access token obtained successfully');
  return tokenData.access_token;
}

// Create Zoom meeting
async function createZoomMeeting(
  accessToken: string,
  customerName: string,
  scheduledDate: string,
  scheduledTime: string
): Promise<{ join_url: string; id: string }> {
  // Parse date and time to create ISO datetime
  // Convert IST time to UTC for Zoom API
  const [hours, minutes] = scheduledTime.split(':').map(Number);
  const dateTimeIST = new Date(`${scheduledDate}T${scheduledTime}:00`);
  
  // IST is UTC+5:30, so subtract 5:30 to get UTC
  const dateTimeUTC = new Date(dateTimeIST.getTime() - (5.5 * 60 * 60 * 1000));
  const startTimeISO = dateTimeUTC.toISOString().replace('.000Z', 'Z');

  console.log('Creating Zoom meeting:', {
    topic: `1:1 Call with ${customerName}`,
    start_time: startTimeISO,
    duration: 60,
  });

  const meetingResponse = await fetch('https://api.zoom.us/v2/users/me/meetings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topic: `1:1 Call with ${customerName}`,
      type: 2, // Scheduled meeting
      start_time: startTimeISO,
      duration: 60, // 1 hour
      timezone: 'Asia/Kolkata',
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        mute_upon_entry: false,
        watermark: false,
        use_pmi: false,
        approval_type: 2, // No registration required
        audio: 'both',
        auto_recording: 'none',
      },
    }),
  });

  if (!meetingResponse.ok) {
    const errorText = await meetingResponse.text();
    console.error('Zoom meeting creation error:', errorText);
    throw new Error(`Failed to create Zoom meeting: ${errorText}`);
  }

  const meetingData = await meetingResponse.json();
  console.log('Zoom meeting created:', {
    id: meetingData.id,
    join_url: meetingData.join_url,
  });

  return {
    join_url: meetingData.join_url,
    id: meetingData.id.toString(),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const aisensyApiKey = Deno.env.get('AISENSY_API_KEY');
    const aisensySource = Deno.env.get('AISENSY_SOURCE');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return new Response(
        JSON.stringify({ error: 'Missing Supabase configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { lead_id, closer_id, scheduled_date, scheduled_time, user_id } = await req.json();

    console.log('Schedule Adesh call request:', {
      lead_id,
      closer_id,
      scheduled_date,
      scheduled_time,
      user_id,
    });

    // Validate required fields
    if (!lead_id || !closer_id || !scheduled_date || !scheduled_time) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', lead_id)
      .single();

    if (leadError || !lead) {
      console.error('Lead not found:', leadError);
      return new Response(
        JSON.stringify({ error: 'Lead not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify closer is Adesh
    const { data: closer, error: closerError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', closer_id)
      .single();

    if (closerError || !closer) {
      console.error('Closer not found:', closerError);
      return new Response(
        JSON.stringify({ error: 'Closer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (closer.email?.toLowerCase() !== ADESH_EMAIL.toLowerCase()) {
      console.error('This endpoint is only for Adesh');
      return new Response(
        JSON.stringify({ error: 'This endpoint is only for Adesh' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Lead found:', lead.contact_name);

    // Step 1: Get Zoom access token
    const accessToken = await getZoomAccessToken();

    // Step 2: Create Zoom meeting
    const meeting = await createZoomMeeting(
      accessToken,
      lead.contact_name,
      scheduled_date,
      scheduled_time
    );

    // Step 3: Update lead assignment
    await supabase
      .from('leads')
      .update({ assigned_to: closer_id })
      .eq('id', lead_id);

    // Step 4: Create call appointment with Zoom link
    const { data: appointment, error: appointmentError } = await supabase
      .from('call_appointments')
      .insert({
        lead_id: lead_id,
        closer_id: closer_id,
        scheduled_date: scheduled_date,
        scheduled_time: scheduled_time,
        status: 'scheduled',
        zoom_link: meeting.join_url,
        created_by: user_id || null,
      })
      .select()
      .single();

    if (appointmentError) {
      console.error('Appointment creation error:', appointmentError);
      throw appointmentError;
    }

    console.log('Appointment created with Zoom link:', appointment.id);

    // Step 5: Send WhatsApp booking confirmation (same template as Akansha)
    let whatsappSent = false;
    const customerPhone = (lead.phone || '').replace(/\D/g, '');

    if (customerPhone && aisensyApiKey && aisensySource) {
      const phoneWithCountry = customerPhone.startsWith('91') ? customerPhone : `91${customerPhone}`;

      // Format date and time for WhatsApp message
      const callDate = new Date(scheduled_date);
      const formattedDate = callDate.toLocaleDateString('en-IN', { 
        day: 'numeric', 
        month: 'long' 
      });
      
      const [hours, minutes] = scheduled_time.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      const formattedTime = `${hour12}:${minutes} ${ampm} IST`;

      console.log('Sending WhatsApp call booking notification (Adesh) to:', phoneWithCountry);

      // Same template as Akansha: 1_to_1_call_booking_crypto_nikist_video
      // 6 parameters:
      // 1- Name of the customer
      // 2- Our Crypto Expert (static)
      // 3- Date of Call Booking
      // 4- Time of Call Booking
      // 5- you will get zoom link 30 minutes before the zoom call (static)
      // 6- +919266395637 (static)
      const whatsappPayload = {
        apiKey: aisensyApiKey,
        campaignName: '1_to_1_call_booking_crypto_nikist_video',
        destination: phoneWithCountry,
        userName: 'Crypto Call',
        source: aisensySource,
        media: {
          url: VIDEO_URL,
          filename: 'booking_confirmation.mp4',
        },
        templateParams: [
          lead.contact_name,               // {{1}} - Name
          'Our Crypto Expert',             // {{2}} - Static text
          formattedDate,                   // {{3}} - Date
          formattedTime,                   // {{4}} - Time
          'you will get zoom link 30 minutes before the zoom call', // {{5}} - Static
          '+919266395637',                 // {{6}} - Contact number
        ],
      };

      console.log('WhatsApp payload (Adesh):', JSON.stringify(whatsappPayload, null, 2));

      try {
        const whatsappResponse = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(whatsappPayload),
        });

        const whatsappResult = await whatsappResponse.json();
        console.log('WhatsApp API response (Adesh):', whatsappResult);
        whatsappSent = whatsappResponse.ok;

        // Update the call_booked reminder status to 'sent'
        if (whatsappSent) {
          await supabase
            .from('call_reminders')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('appointment_id', appointment.id)
            .eq('reminder_type', 'call_booked');
        }
      } catch (whatsappError) {
        console.error('WhatsApp send error (Adesh):', whatsappError);
      }
    } else {
      console.log('Skipping WhatsApp: missing phone or AiSensy config');
    }

    console.log('Adesh call scheduled successfully');

    return new Response(
      JSON.stringify({
        success: true,
        appointment_id: appointment.id,
        zoom_link: meeting.join_url,
        whatsapp_sent: whatsappSent,
        closer: 'adesh',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in schedule-adesh-call:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
