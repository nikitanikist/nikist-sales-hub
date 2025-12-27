import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ADESH_EMAIL = "aadeshnikist@gmail.com";

// Get Zoom access token using Server-to-Server OAuth for Adesh
async function getZoomAccessToken(): Promise<string> {
  const accountId = Deno.env.get('ZOOM_ADESH_ACCOUNT_ID');
  const clientId = Deno.env.get('ZOOM_ADESH_CLIENT_ID');
  const clientSecret = Deno.env.get('ZOOM_ADESH_CLIENT_SECRET');

  if (!accountId || !clientId || !clientSecret) {
    throw new Error('Missing Zoom credentials for Adesh');
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);
  
  const response = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=account_credentials&account_id=${accountId}`,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Zoom OAuth error:', errorText);
    throw new Error(`Failed to get Zoom access token: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Create Zoom meeting for Adesh
async function createZoomMeeting(
  accessToken: string, 
  topic: string, 
  scheduledDate: string, 
  scheduledTime: string
): Promise<{ join_url: string; meeting_id: string }> {
  // Handle time in format HH:mm:ss or HH:mm
  const timeParts = scheduledTime.split(':');
  const hours = parseInt(timeParts[0], 10);
  const minutes = parseInt(timeParts[1], 10);
  
  // Create IST datetime string
  const istDateTimeStr = `${scheduledDate}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00+05:30`;
  const istDateTime = new Date(istDateTimeStr);
  
  if (isNaN(istDateTime.getTime())) {
    throw new Error(`Invalid date/time: ${scheduledDate} ${scheduledTime}`);
  }
  
  const startTime = istDateTime.toISOString();

  console.log(`Creating Zoom meeting - IST: ${scheduledDate} ${scheduledTime}, UTC: ${startTime}`);

  const response = await fetch('https://api.zoom.us/v2/users/me/meetings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topic: topic,
      type: 2, // Scheduled meeting
      start_time: startTime,
      duration: 60, // 60 minutes
      timezone: 'Asia/Kolkata',
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: true,
        waiting_room: false,
        mute_upon_entry: false,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Zoom meeting creation error:', errorText);
    throw new Error(`Failed to create Zoom meeting: ${response.status}`);
  }

  const meetingData = await response.json();
  console.log('Zoom meeting created:', meetingData.id);
  
  return {
    join_url: meetingData.join_url,
    meeting_id: meetingData.id.toString(),
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { appointment_id } = await req.json();

    if (!appointment_id) {
      throw new Error('Missing appointment_id');
    }

    console.log(`Creating Zoom link for appointment: ${appointment_id}`);

    // Fetch appointment with lead and closer details
    const { data: appointment, error: appointmentError } = await supabase
      .from('call_appointments')
      .select(`
        id,
        lead_id,
        closer_id,
        scheduled_date,
        scheduled_time,
        zoom_link,
        leads:lead_id (
          contact_name,
          email,
          phone
        ),
        closer:closer_id (
          full_name,
          email
        )
      `)
      .eq('id', appointment_id)
      .maybeSingle();

    if (appointmentError) {
      console.error('Error fetching appointment:', appointmentError);
      throw new Error(`Failed to fetch appointment: ${appointmentError.message}`);
    }

    if (!appointment) {
      throw new Error(`Appointment not found: ${appointment_id}`);
    }

    const leadsData = appointment.leads as unknown as { contact_name: string; email: string; phone: string } | { contact_name: string; email: string; phone: string }[] | null;
    const closerData = appointment.closer as unknown as { full_name: string; email: string } | { full_name: string; email: string }[] | null;
    
    const lead = Array.isArray(leadsData) ? leadsData[0] : leadsData;
    const closer = Array.isArray(closerData) ? closerData[0] : closerData;

    if (!lead || !closer) {
      throw new Error('Lead or closer information not found');
    }

    console.log(`Appointment details: Lead=${lead.contact_name}, Closer=${closer.full_name}, Date=${appointment.scheduled_date}, Time=${appointment.scheduled_time}`);

    // Verify this is an Adesh appointment
    if (closer.email?.toLowerCase() !== ADESH_EMAIL.toLowerCase()) {
      throw new Error(`This function only supports Adesh's appointments. Closer email: ${closer.email}`);
    }

    // Get Zoom access token
    console.log('Getting Zoom access token for Adesh...');
    const accessToken = await getZoomAccessToken();

    // Create Zoom meeting
    const meetingTopic = `1:1 Call with ${lead.contact_name}`;
    console.log(`Creating Zoom meeting: ${meetingTopic}`);
    
    const { join_url, meeting_id } = await createZoomMeeting(
      accessToken,
      meetingTopic,
      appointment.scheduled_date,
      appointment.scheduled_time
    );

    console.log(`Zoom meeting created: ${meeting_id}, Link: ${join_url}`);

    // Update the appointment with the new Zoom link
    const { error: updateError } = await supabase
      .from('call_appointments')
      .update({ zoom_link: join_url })
      .eq('id', appointment_id);

    if (updateError) {
      console.error('Error updating appointment:', updateError);
      throw new Error(`Failed to update appointment with Zoom link: ${updateError.message}`);
    }

    console.log('Appointment updated with new Zoom link');

    return new Response(
      JSON.stringify({
        success: true,
        zoom_link: join_url,
        meeting_id: meeting_id,
        message: `Zoom link created and saved for ${lead.contact_name}`,
        appointment: {
          id: appointment_id,
          lead_name: lead.contact_name,
          scheduled_date: appointment.scheduled_date,
          scheduled_time: appointment.scheduled_time,
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in create-zoom-link:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
