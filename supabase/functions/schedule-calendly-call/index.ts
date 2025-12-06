import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Dipanshu's Calendly configuration (hardcoded)
const DIPANSHU_USER_ID = "nikistofficial@gmail.com"; // Dipanshu's email
const CALENDLY_EVENT_URL = "https://calendly.com/nikist/1-1-call-with-dipanshu-malasi-clone";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const calendlyToken = Deno.env.get('CALENDLY_DIPANSHU_TOKEN');
    const aisensyApiKey = Deno.env.get('AISENSY_API_KEY');
    const aisensySource = Deno.env.get('AISENSY_SOURCE');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!calendlyToken || !aisensyApiKey || !aisensySource) {
      console.error('Missing required secrets');
      return new Response(
        JSON.stringify({ error: 'Missing required configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    const { lead_id, closer_id, scheduled_date, scheduled_time, user_id } = await req.json();
    
    console.log('Received request:', { lead_id, closer_id, scheduled_date, scheduled_time, user_id });

    // Fetch lead details
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', lead_id)
      .single();

    if (leadError || !lead) {
      console.error('Lead fetch error:', leadError);
      return new Response(
        JSON.stringify({ error: 'Lead not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch closer details to verify it's Dipanshu
    const { data: closer, error: closerError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', closer_id)
      .single();

    if (closerError || !closer) {
      console.error('Closer fetch error:', closerError);
      return new Response(
        JSON.stringify({ error: 'Closer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this is Dipanshu (by email)
    const isDipanshu = closer.email?.toLowerCase() === DIPANSHU_USER_ID.toLowerCase();
    
    if (!isDipanshu) {
      // For non-Dipanshu closers, just create the appointment without Calendly
      console.log('Non-Dipanshu closer, creating appointment without Calendly');
      
      const { error: assignError } = await supabase
        .from('leads')
        .update({ assigned_to: closer_id })
        .eq('id', lead_id);

      if (assignError) {
        console.error('Lead assignment error:', assignError);
        throw assignError;
      }

      const { data: appointment, error: appointmentError } = await supabase
        .from('call_appointments')
        .insert({
          lead_id,
          closer_id,
          scheduled_date,
          scheduled_time,
          status: 'scheduled',
          created_by: user_id,
        })
        .select()
        .single();

      if (appointmentError) {
        console.error('Appointment creation error:', appointmentError);
        throw appointmentError;
      }

      return new Response(
        JSON.stringify({ success: true, appointment, calendly: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For Dipanshu: Create Calendly booking
    console.log('Dipanshu closer detected, creating Calendly booking');

    // Step 1: Get Calendly user info to find event type
    const userResponse = await fetch('https://api.calendly.com/users/me', {
      headers: {
        'Authorization': `Bearer ${calendlyToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('Calendly user fetch error:', errorText);
      throw new Error(`Failed to fetch Calendly user: ${errorText}`);
    }

    const userData = await userResponse.json();
    const userUri = userData.resource.uri;
    console.log('Calendly user URI:', userUri);

    // Step 2: Get event types for this user
    const eventTypesResponse = await fetch(
      `https://api.calendly.com/event_types?user=${encodeURIComponent(userUri)}&active=true`,
      {
        headers: {
          'Authorization': `Bearer ${calendlyToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!eventTypesResponse.ok) {
      const errorText = await eventTypesResponse.text();
      console.error('Calendly event types fetch error:', errorText);
      throw new Error(`Failed to fetch event types: ${errorText}`);
    }

    const eventTypesData = await eventTypesResponse.json();
    console.log('Event types found:', eventTypesData.collection.length);
    
    // Find the matching event type (the 1:1 call event)
    const eventType = eventTypesData.collection.find((et: any) => 
      et.scheduling_url.includes('1-1-call-with-dipanshu-malasi-clone') || 
      et.name.toLowerCase().includes('1:1') ||
      et.name.toLowerCase().includes('1-1')
    ) || eventTypesData.collection[0];

    if (!eventType) {
      console.error('No event type found');
      throw new Error('No Calendly event type found');
    }

    console.log('Using event type:', eventType.name, eventType.uri);

    // Step 3: Create scheduled event via Calendly API
    // Convert date and time to ISO format
    const scheduledDateTime = new Date(`${scheduled_date}T${scheduled_time}`);
    const startTimeISO = scheduledDateTime.toISOString();
    
    // Calculate end time (assuming 30 min call)
    const endDateTime = new Date(scheduledDateTime.getTime() + 30 * 60 * 1000);
    const endTimeISO = endDateTime.toISOString();

    console.log('Scheduling for:', startTimeISO, 'to', endTimeISO);

    // Create a scheduled event using Calendly's scheduled events API
    const scheduleResponse = await fetch('https://api.calendly.com/scheduled_events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${calendlyToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: eventType.uri,
        start_time: startTimeISO,
        end_time: endTimeISO,
        invitee: {
          name: lead.contact_name,
          email: lead.email,
          timezone: 'Asia/Kolkata',
        },
        location: {
          kind: 'zoom_conference',
        },
      }),
    });

    let zoomLink = null;
    let calendlyEventUri = null;
    let calendlyInviteeUri = null;

    if (scheduleResponse.ok) {
      const scheduleData = await scheduleResponse.json();
      console.log('Calendly event created:', scheduleData);
      
      calendlyEventUri = scheduleData.resource?.uri;
      zoomLink = scheduleData.resource?.location?.join_url;
      
      // Fetch invitee details if available
      if (scheduleData.resource?.uri) {
        const inviteesResponse = await fetch(
          `${scheduleData.resource.uri}/invitees`,
          {
            headers: {
              'Authorization': `Bearer ${calendlyToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (inviteesResponse.ok) {
          const inviteesData = await inviteesResponse.json();
          if (inviteesData.collection?.length > 0) {
            calendlyInviteeUri = inviteesData.collection[0].uri;
          }
        }
      }
    } else {
      // If direct scheduling fails, we'll proceed without Calendly but log the error
      const errorText = await scheduleResponse.text();
      console.warn('Calendly scheduling failed (will proceed without Zoom link):', errorText);
    }

    // Step 4: Assign lead to closer
    const { error: assignError } = await supabase
      .from('leads')
      .update({ assigned_to: closer_id })
      .eq('id', lead_id);

    if (assignError) {
      console.error('Lead assignment error:', assignError);
      throw assignError;
    }

    // Step 5: Create call appointment with Zoom link
    const { data: appointment, error: appointmentError } = await supabase
      .from('call_appointments')
      .insert({
        lead_id,
        closer_id,
        scheduled_date,
        scheduled_time,
        status: 'scheduled',
        created_by: user_id,
        zoom_link: zoomLink,
        calendly_event_uri: calendlyEventUri,
        calendly_invitee_uri: calendlyInviteeUri,
      })
      .select()
      .single();

    if (appointmentError) {
      console.error('Appointment creation error:', appointmentError);
      throw appointmentError;
    }

    console.log('Appointment created:', appointment.id);

    // Step 6: Send "Call Booked" WhatsApp message immediately
    const customerPhone = lead.phone?.replace(/\D/g, '') || '';
    const phoneWithCountry = customerPhone.startsWith('91') ? customerPhone : `91${customerPhone}`;

    // Format date and time for WhatsApp message
    const callDate = new Date(scheduled_date);
    const formattedDate = callDate.toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'long' 
    }); // e.g., "12 December"
    
    const [hours, minutes] = scheduled_time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    const formattedTime = `${hour12}:${minutes} ${ampm} IST`; // e.g., "7:00 PM IST"

    console.log('Sending WhatsApp call booking notification to:', phoneWithCountry);

    const whatsappPayload = {
      apiKey: aisensyApiKey,
      campaignName: '1_to_1_call_booking_crypto_dipanshu',
      destination: phoneWithCountry,
      userName: 'Crypto Call',
      source: aisensySource,
      media: {
        url: 'https://d3jt6ku4g6z5l8.cloudfront.net/VIDEO/66f4f03f444c5c0b8013168b/227807_Updated 11.mp4',
        filename: 'booking_confirmation.mp4',
      },
      templateParams: [
        lead.contact_name, // {{1}} - Name
        formattedDate, // {{2}} - Date
        formattedTime, // {{3}} - Time
        'Zoom link will be shared 10 minutes before the call', // {{4}}
        '+919266395637', // {{5}} - Contact number
      ],
    };

    console.log('WhatsApp payload:', JSON.stringify(whatsappPayload, null, 2));

    const whatsappResponse = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(whatsappPayload),
    });

    const whatsappResult = await whatsappResponse.json();
    console.log('WhatsApp API response:', whatsappResult);

    // Update the call_booked reminder status to 'sent'
    await supabase
      .from('call_reminders')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('appointment_id', appointment.id)
      .eq('reminder_type', 'call_booked');

    return new Response(
      JSON.stringify({ 
        success: true, 
        appointment, 
        calendly: true,
        zoom_link: zoomLink,
        whatsapp_sent: whatsappResponse.ok,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in schedule-calendly-call:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
