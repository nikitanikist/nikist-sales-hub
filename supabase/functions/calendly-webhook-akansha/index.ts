import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Akansha's configuration (hardcoded - this webhook is only for Akansha)
const AKANSHA_EMAIL = "akanshanikist@gmail.com";
const VIDEO_URL = 'https://d3jt6ku4g6z5l8.cloudfront.net/VIDEO/66f4f03f444c5c0b8013168b/5384969_1706706new video 1 14.mp4';

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
    console.log('Akansha Calendly webhook received:', JSON.stringify(payload, null, 2));

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
                     eventPayload.tracking?.utm_content || 
                     null;
    const calendlyEventUri = scheduledEvent.uri || eventPayload.uri;
    const calendlyInviteeUri = invitee.uri;

    console.log('Akansha webhook - Extracted data:', {
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

    // Step 1: Find Akansha's profile ID
    const { data: akanshaProfile, error: akanshaError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', AKANSHA_EMAIL)
      .single();

    if (akanshaError || !akanshaProfile) {
      console.error('Akansha profile not found:', akanshaError);
      return new Response(
        JSON.stringify({ error: 'Closer profile not found' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const closerId = akanshaProfile.id;
    console.log('Akansha closer ID:', closerId);

    // Step 2: Find or create lead by email (handle duplicates - pick most recent)
    let { data: leads, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('email', customerEmail)
      .order('created_at', { ascending: false })
      .limit(1);

    if (leadError) {
      console.error('Lead lookup error:', leadError);
      throw leadError;
    }

    let lead = leads?.[0] || null;
    console.log('Lead lookup result:', lead ? `Found lead ${lead.id} (${lead.workshop_name || 'no workshop'})` : 'No existing lead');

    // Parse phone number to extract country code and clean digits
    const rawPhone = customerPhone || '';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    
    let countryCode: string | null = null;
    let phoneDigits: string | null = cleanPhone || null;
    
    // Handle common patterns for Indian numbers
    if (cleanPhone.startsWith('91') && cleanPhone.length > 10) {
      countryCode = '91';
      phoneDigits = cleanPhone.slice(2);
    } else if (cleanPhone.length === 10) {
      countryCode = '91';
      phoneDigits = cleanPhone;
    } else if (cleanPhone.length > 10) {
      if (cleanPhone.startsWith('1') && cleanPhone.length === 11) {
        countryCode = '1';
        phoneDigits = cleanPhone.slice(1);
      } else if (cleanPhone.startsWith('44') && cleanPhone.length >= 12) {
        countryCode = '44';
        phoneDigits = cleanPhone.slice(2);
      } else if (cleanPhone.startsWith('61') && cleanPhone.length >= 11) {
        countryCode = '61';
        phoneDigits = cleanPhone.slice(2);
      }
    }
    
    console.log('Parsed phone:', { rawPhone, countryCode, phoneDigits });

    if (!lead) {
      // Create new lead
      console.log('Creating new lead for:', customerEmail);
      const { data: newLead, error: createError } = await supabase
        .from('leads')
        .insert({
          contact_name: customerName,
          email: customerEmail,
          phone: phoneDigits,
          country: countryCode,
          company_name: customerName,
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
      // Update existing lead
      console.log('Existing lead found:', lead.id);
      const updateData: Record<string, any> = { assigned_to: closerId };
      
      if (countryCode) {
        updateData.country = countryCode;
      }
      if (phoneDigits) {
        updateData.phone = phoneDigits;
      }
      
      await supabase
        .from('leads')
        .update(updateData)
        .eq('id', lead.id);
    }

    // Step 3: Parse scheduled date and time
    const scheduledDateTime = new Date(startTime);
    const scheduledDate = scheduledDateTime.toISOString().split('T')[0];
    
    // Convert to IST for time storage
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDateTime = new Date(scheduledDateTime.getTime() + istOffset);
    const scheduledTime = istDateTime.toISOString().split('T')[1].substring(0, 5);

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

    console.log('Akansha appointment created:', appointment.id);

    // Step 6: Send "Call Booked" WhatsApp message with Akansha's template
    let whatsappSent = false;
    const phoneForWhatsApp = (lead.phone || customerPhone || '').replace(/\D/g, '');
    
    if (phoneForWhatsApp && aisensyApiKey && aisensySource) {
      const phoneWithCountry = phoneForWhatsApp.startsWith('91') ? phoneForWhatsApp : `91${phoneForWhatsApp}`;

      // Format date and time for WhatsApp message
      const callDate = new Date(scheduledDate);
      const formattedDate = callDate.toLocaleDateString('en-IN', { 
        day: 'numeric', 
        month: 'long' 
      });
      
      const [hours, minutes] = scheduledTime.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      const formattedTime = `${hour12}:${minutes} ${ampm} IST`;

      console.log('Sending WhatsApp call booking notification (Akansha) to:', phoneWithCountry);

      // Akansha's template: 1_to_1_call_booking_crypto_nikist_video
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
          lead.contact_name || customerName, // {{1}} - Name
          'Our Crypto Expert',               // {{2}} - Static text
          formattedDate,                     // {{3}} - Date
          formattedTime,                     // {{4}} - Time
          'you will get zoom link 30 minutes before the zoom call', // {{5}} - Static
          '+919266395637',                   // {{6}} - Contact number
        ],
      };

      console.log('WhatsApp payload (Akansha):', JSON.stringify(whatsappPayload, null, 2));

      try {
        const whatsappResponse = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(whatsappPayload),
        });

        const whatsappResult = await whatsappResponse.json();
        console.log('WhatsApp API response (Akansha):', whatsappResult);
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
        console.error('WhatsApp send error (Akansha):', whatsappError);
      }
    } else {
      console.log('Skipping WhatsApp: missing phone or AiSensy config');
    }

    // Send notification to closer (Akansha)
    let closerNotificationSent = false;
    try {
      console.log('Sending notification to closer for appointment:', appointment.id);
      const notificationResponse = await fetch(`${supabaseUrl}/functions/v1/send-closer-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ appointment_id: appointment.id }),
      });
      const notificationResult = await notificationResponse.json();
      console.log('Closer notification result:', notificationResult);
      closerNotificationSent = notificationResponse.ok;
    } catch (notificationError) {
      console.error('Error sending closer notification:', notificationError);
    }

    console.log('Akansha Calendly webhook processed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        appointment_id: appointment.id,
        lead_id: lead.id,
        whatsapp_sent: whatsappSent,
        closer_notification_sent: closerNotificationSent,
        closer: 'akansha',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in calendly-webhook-akansha:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
