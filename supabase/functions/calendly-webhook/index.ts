import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Dipanshu's configuration (hardcoded - this webhook is only for Dipanshu)
const DIPANSHU_EMAIL = "nikistofficial@gmail.com";

serve(async (req) => {
  // Handle CORS preflight requests
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

    // Parse the Calendly webhook payload
    const payload = await req.json();
    console.log('Calendly webhook received:', JSON.stringify(payload, null, 2));

    // Verify this is an invitee.created event
    if (payload.event !== 'invitee.created') {
      console.log('Ignoring non-invitee.created event:', payload.event);
      return new Response(
        JSON.stringify({ message: 'Event ignored', event: payload.event }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract data from Calendly payload
    const eventPayload = payload.payload;
    const invitee = eventPayload.invitee || eventPayload;
    const scheduledEvent = eventPayload.scheduled_event || eventPayload.event || {};
    
    // Customer details
    const customerName = invitee.name || invitee.invitee_name || 'Unknown';
    const customerEmail = invitee.email || invitee.invitee_email || '';
    const customerPhone = invitee.text_reminder_number || 
                          invitee.questions_and_answers?.find((q: any) => 
                            q.question?.toLowerCase().includes('phone') || 
                            q.question?.toLowerCase().includes('mobile')
                          )?.answer || '';

    // Event details
    const startTime = scheduledEvent.start_time || eventPayload.event_start_time;
    const zoomLink = scheduledEvent.location?.join_url || 
                     eventPayload.tracking?.utm_content || // Sometimes Zoom link is here
                     null;
    const calendlyEventUri = scheduledEvent.uri || eventPayload.uri;
    const calendlyInviteeUri = invitee.uri;

    console.log('Extracted data:', {
      customerName,
      customerEmail,
      customerPhone,
      startTime,
      zoomLink,
      calendlyEventUri,
      calendlyInviteeUri,
    });

    if (!customerEmail) {
      console.error('No customer email in webhook payload');
      return new Response(
        JSON.stringify({ error: 'No customer email provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Find Dipanshu's profile ID
    const { data: dipanshuProfile, error: dipanshuError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', DIPANSHU_EMAIL)
      .single();

    if (dipanshuError || !dipanshuProfile) {
      console.error('Dipanshu profile not found:', dipanshuError);
      return new Response(
        JSON.stringify({ error: 'Closer profile not found' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const closerId = dipanshuProfile.id;
    console.log('Dipanshu closer ID:', closerId);

    // Step 2: Find or create lead by email
    let { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('email', customerEmail)
      .maybeSingle();

    if (leadError) {
      console.error('Lead lookup error:', leadError);
      throw leadError;
    }

    if (!lead) {
      // Create new lead
      console.log('Creating new lead for:', customerEmail);
      const { data: newLead, error: createError } = await supabase
        .from('leads')
        .insert({
          contact_name: customerName,
          email: customerEmail,
          phone: customerPhone || null,
          company_name: customerName, // Use name as company for new leads
          status: 'new',
          assigned_to: closerId,
          source: 'calendly',
        })
        .select()
        .single();

      if (createError) {
        console.error('Lead creation error:', createError);
        throw createError;
      }
      lead = newLead;
      console.log('New lead created:', lead.id);
    } else {
      // Update existing lead assignment
      console.log('Existing lead found:', lead.id);
      await supabase
        .from('leads')
        .update({ assigned_to: closerId })
        .eq('id', lead.id);
    }

    // Step 3: Parse scheduled date and time
    const scheduledDateTime = new Date(startTime);
    const scheduledDate = scheduledDateTime.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Convert to IST for time storage
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const istDateTime = new Date(scheduledDateTime.getTime() + istOffset);
    const scheduledTime = istDateTime.toISOString().split('T')[1].substring(0, 5); // HH:MM

    console.log('Parsed schedule:', { scheduledDate, scheduledTime });

    // Step 4: Check if appointment already exists (avoid duplicates)
    const { data: existingAppointment } = await supabase
      .from('call_appointments')
      .select('id')
      .eq('calendly_event_uri', calendlyEventUri)
      .maybeSingle();

    if (existingAppointment) {
      console.log('Appointment already exists for this Calendly event:', existingAppointment.id);
      return new Response(
        JSON.stringify({ message: 'Appointment already exists', appointment_id: existingAppointment.id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 5: Create call appointment
    const { data: appointment, error: appointmentError } = await supabase
      .from('call_appointments')
      .insert({
        lead_id: lead.id,
        closer_id: closerId,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        status: 'scheduled',
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

    // Step 6: Send "Call Booked" WhatsApp message
    let whatsappSent = false;
    const phoneForWhatsApp = (lead.phone || customerPhone || '').replace(/\D/g, '');
    
    if (phoneForWhatsApp && aisensyApiKey && aisensySource) {
      const phoneWithCountry = phoneForWhatsApp.startsWith('91') ? phoneForWhatsApp : `91${phoneForWhatsApp}`;

      // Format date and time for WhatsApp message
      const callDate = new Date(scheduledDate);
      const formattedDate = callDate.toLocaleDateString('en-IN', { 
        day: 'numeric', 
        month: 'long' 
      }); // e.g., "12 December"
      
      const [hours, minutes] = scheduledTime.split(':');
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
          lead.contact_name || customerName, // {{1}} - Name
          formattedDate, // {{2}} - Date
          formattedTime, // {{3}} - Time
          zoomLink || 'Zoom link will be shared 10 minutes before the call', // {{4}}
          '+919266395637', // {{5}} - Contact number
        ],
      };

      console.log('WhatsApp payload:', JSON.stringify(whatsappPayload, null, 2));

      try {
        const whatsappResponse = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(whatsappPayload),
        });

        const whatsappResult = await whatsappResponse.json();
        console.log('WhatsApp API response:', whatsappResult);
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
        console.error('WhatsApp send error:', whatsappError);
      }
    } else {
      console.log('Skipping WhatsApp: missing phone or AiSensy config');
    }

    console.log('Calendly webhook processed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        appointment_id: appointment.id,
        lead_id: lead.id,
        whatsapp_sent: whatsappSent,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in calendly-webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
