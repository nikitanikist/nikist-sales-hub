import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

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
                     eventPayload.tracking?.utm_content || 
                     null;
    const calendlyEventUri = scheduledEvent.uri || eventPayload.uri;
    const calendlyInviteeUri = invitee.uri;
    const eventTypeUri = scheduledEvent.event_type?.uri || eventPayload.event_type;

    console.log('Extracted data:', {
      customerName,
      customerEmail,
      customerPhone,
      startTime,
      zoomLink,
      calendlyEventUri,
      calendlyInviteeUri,
      eventTypeUri,
    });

    if (!customerEmail) {
      console.error('No customer email in webhook payload');
      return new Response(
        JSON.stringify({ error: 'No customer email provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // STEP 1: Find organization and closer by Calendly event type URI
    let organizationId: string | null = null;
    let closerId: string | null = null;

    if (eventTypeUri) {
      // Try to find organization that has this Calendly event type configured
      const { data: calendlyIntegrations } = await supabase
        .from('organization_integrations')
        .select('organization_id, config')
        .eq('integration_type', 'calendly')
        .eq('is_active', true);

      if (calendlyIntegrations) {
        for (const integration of calendlyIntegrations) {
          const config = integration.config as { event_type_uri?: string; default_closer_id?: string };
          if (config.event_type_uri === eventTypeUri) {
            organizationId = integration.organization_id;
            closerId = config.default_closer_id || null;
            console.log('Found organization by event type URI:', organizationId);
            break;
          }
        }
      }
    }

    // Fallback: Use default organization if not found
    if (!organizationId) {
      organizationId = '00000000-0000-0000-0000-000000000001';
      console.log('Using default organization:', organizationId);
    }

    // If no closer found from integration, try to find one
    if (!closerId) {
      // Get first available closer for this organization
      const { data: orgClosers } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', organizationId)
        .eq('role', 'sales_rep')
        .limit(1);

      if (orgClosers && orgClosers.length > 0) {
        closerId = orgClosers[0].user_id;
      }
    }

    if (!closerId) {
      console.error('No closer found for organization:', organizationId);
      return new Response(
        JSON.stringify({ error: 'No closer configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Using closer ID:', closerId);

    // STEP 2: Find or create lead by email
    let { data: leads, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('email', customerEmail)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (leadError) {
      console.error('Lead lookup error:', leadError);
      throw leadError;
    }

    let lead = leads?.[0] || null;
    console.log('Lead lookup result:', lead ? `Found lead ${lead.id}` : 'No existing lead');

    // Parse phone number
    const rawPhone = customerPhone || '';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    
    let countryCode: string | null = null;
    let phoneDigits: string | null = cleanPhone || null;
    
    if (cleanPhone.startsWith('91') && cleanPhone.length > 10) {
      countryCode = '91';
      phoneDigits = cleanPhone.slice(2);
    } else if (cleanPhone.length === 10) {
      countryCode = '91';
      phoneDigits = cleanPhone;
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
          organization_id: organizationId,
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
      const updateData: Record<string, any> = { assigned_to: closerId };
      if (countryCode) updateData.country = countryCode;
      if (phoneDigits) updateData.phone = phoneDigits;
      
      await supabase
        .from('leads')
        .update(updateData)
        .eq('id', lead.id);
    }

    // STEP 3: Parse scheduled date and time
    const scheduledDateTime = new Date(startTime);
    const scheduledDate = scheduledDateTime.toISOString().split('T')[0];
    
    // Convert to IST
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDateTime = new Date(scheduledDateTime.getTime() + istOffset);
    const scheduledTime = istDateTime.toISOString().split('T')[1].substring(0, 5);

    console.log('Parsed schedule:', { scheduledDate, scheduledTime });

    // STEP 4: Check if appointment already exists
    const { data: existingAppointment } = await supabase
      .from('call_appointments')
      .select('id')
      .eq('calendly_event_uri', calendlyEventUri)
      .maybeSingle();

    if (existingAppointment) {
      console.log('Appointment already exists:', existingAppointment.id);
      return new Response(
        JSON.stringify({ message: 'Appointment already exists', appointment_id: existingAppointment.id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // STEP 5: Create call appointment
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
        organization_id: organizationId,
      })
      .select()
      .single();

    if (appointmentError) {
      console.error('Appointment creation error:', appointmentError);
      throw appointmentError;
    }

    console.log('Appointment created:', appointment.id);

    // STEP 6: Send WhatsApp notification using org's integration
    let whatsappSent = false;
    const phoneForWhatsApp = (lead.phone || customerPhone || '').replace(/\D/g, '');
    
    // Get WhatsApp config for this organization
    const { data: whatsappIntegration } = await supabase
      .from('organization_integrations')
      .select('config')
      .eq('organization_id', organizationId)
      .eq('integration_type', 'whatsapp')
      .eq('is_active', true)
      .maybeSingle();

    const whatsappConfig = whatsappIntegration?.config as { api_key?: string; source?: string; video_url?: string } | null;
    const aisensyApiKey = whatsappConfig?.api_key || Deno.env.get('AISENSY_API_KEY');
    const aisensySource = whatsappConfig?.source || Deno.env.get('AISENSY_SOURCE');
    
    if (phoneForWhatsApp && aisensyApiKey && aisensySource) {
      const phoneWithCountry = phoneForWhatsApp.startsWith('91') ? phoneForWhatsApp : `91${phoneForWhatsApp}`;

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

      console.log('Sending WhatsApp call booking notification to:', phoneWithCountry);

      const whatsappPayload = {
        apiKey: aisensyApiKey,
        campaignName: '1_to_1_call_booking_crypto_nikist_video',
        destination: phoneWithCountry,
        userName: 'Crypto Call',
        source: aisensySource,
        media: {
          url: whatsappConfig?.video_url || 'https://d3jt6ku4g6z5l8.cloudfront.net/VIDEO/66f4f03f444c5c0b8013168b/5384969_1706706new video 1 14.mp4',
          filename: 'booking_confirmation.mp4',
        },
        templateParams: [
          lead.contact_name || customerName,
          'Our Crypto Expert',
          formattedDate,
          formattedTime,
          'you will get zoom link 30 minutes before the zoom call',
          '+919266395637',
        ],
      };

      try {
        const whatsappResponse = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(whatsappPayload),
        });

        const whatsappResult = await whatsappResponse.json();
        console.log('WhatsApp API response:', whatsappResult);
        whatsappSent = whatsappResponse.ok;

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
    }

    // Send notification to closer
    let closerNotificationSent = false;
    try {
      const notificationResponse = await fetch(`${supabaseUrl}/functions/v1/send-closer-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ appointment_id: appointment.id }),
      });
      closerNotificationSent = notificationResponse.ok;
    } catch (notificationError) {
      console.error('Error sending closer notification:', notificationError);
    }

    console.log('Calendly webhook processed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        appointment_id: appointment.id,
        lead_id: lead.id,
        organization_id: organizationId,
        whatsapp_sent: whatsappSent,
        closer_notification_sent: closerNotificationSent,
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
