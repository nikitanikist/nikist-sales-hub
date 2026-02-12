import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Get Zoom access token using Server-to-Server OAuth from org integration config
async function getZoomAccessToken(zoomConfig: { account_id: string; client_id: string; client_secret: string }): Promise<string> {
  const { account_id, client_id, client_secret } = zoomConfig;

  if (!account_id || !client_id || !client_secret) {
    throw new Error('Missing Zoom credentials in integration config');
  }

  const credentials = btoa(`${client_id}:${client_secret}`);
  
  const response = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=account_credentials&account_id=${account_id}`,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Zoom OAuth error:', errorText);
    throw new Error(`Failed to get Zoom access token: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Create Zoom meeting
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
  
  // Send time directly as IST format without UTC conversion
  const startTime = `${scheduledDate}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;

  console.log(`Creating Zoom meeting - IST Date: ${scheduledDate}, IST Time: ${scheduledTime}, Start Time for Zoom: ${startTime}`);

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
      duration: 90, // 90 minutes
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

    // Fetch appointment with lead, closer, and organization details
    const { data: appointment, error: appointmentError } = await supabase
      .from('call_appointments')
      .select(`
        id,
        lead_id,
        closer_id,
        scheduled_date,
        scheduled_time,
        zoom_link,
        organization_id,
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

    // Get Zoom integration for this organization
    const { data: zoomIntegration, error: integrationError } = await supabase
      .from('organization_integrations')
      .select('config')
      .eq('organization_id', appointment.organization_id)
      .eq('integration_type', 'zoom')
      .eq('is_active', true)
      .maybeSingle();

    if (integrationError) {
      console.error('Error fetching Zoom integration:', integrationError);
      throw new Error(`Failed to fetch Zoom integration: ${integrationError.message}`);
    }

    if (!zoomIntegration) {
      throw new Error('Zoom integration not configured for this organization');
    }

    // Check if this closer has Zoom integration mapped
    const { data: closerIntegration } = await supabase
      .from('closer_integrations')
      .select('integration_id')
      .eq('closer_id', appointment.closer_id)
      .eq('organization_id', appointment.organization_id)
      .maybeSingle();

    // If closer has specific integration, verify it's a Zoom one and use its config
    let zoomConfig: { account_id: string; client_id: string; client_secret: string };

    if (closerIntegration) {
      const { data: specificIntegration } = await supabase
        .from('organization_integrations')
        .select('config, integration_type')
        .eq('id', closerIntegration.integration_id)
        .eq('integration_type', 'zoom')
        .eq('is_active', true)
        .maybeSingle();

      if (!specificIntegration) {
        throw new Error(`This closer does not have Zoom integration configured`);
      }
      
      const rawConfig = specificIntegration.config as Record<string, unknown>;
      if (rawConfig.uses_env_secrets) {
        zoomConfig = {
          account_id: Deno.env.get(rawConfig.account_id_secret as string) || '',
          client_id: Deno.env.get(rawConfig.client_id_secret as string) || '',
          client_secret: Deno.env.get(rawConfig.client_secret_secret as string) || '',
        };
      } else {
        zoomConfig = rawConfig as { account_id: string; client_id: string; client_secret: string };
      }
    } else {
      const rawConfig = zoomIntegration.config as Record<string, unknown>;
      if (rawConfig.uses_env_secrets) {
        zoomConfig = {
          account_id: Deno.env.get(rawConfig.account_id_secret as string) || '',
          client_id: Deno.env.get(rawConfig.client_id_secret as string) || '',
          client_secret: Deno.env.get(rawConfig.client_secret_secret as string) || '',
        };
      } else {
        zoomConfig = rawConfig as { account_id: string; client_id: string; client_secret: string };
      }
    }

    // Get Zoom access token
    console.log('Getting Zoom access token...');
    const accessToken = await getZoomAccessToken(zoomConfig);

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
