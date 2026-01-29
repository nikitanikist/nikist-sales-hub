import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Template for booking confirmation (using Akansha's template which works for all)
const BOOKING_TEMPLATE = '1_to_1_call_booking_crypto_nikist_video';
const VIDEO_URL = 'https://d3jt6ku4g6z5l8.cloudfront.net/VIDEO/66f4f03f444c5c0b8013168b/5384969_1706706new video 1 14.mp4';

// Kamal's configuration (call booker notification)
const KAMAL_NAME = "Kamal";
const KAMAL_PHONE = "918285632307";

// Integration config types
interface ZoomConfig {
  account_id: string;
  client_id: string;
  client_secret: string;
  host_email?: string;
}

interface CalendlyConfig {
  api_token: string;
  calendly_url?: string;
  event_type_uri?: string;
}

// Get Zoom access token using Server-to-Server OAuth from integration config
async function getZoomAccessToken(config: ZoomConfig): Promise<string> {
  const { account_id, client_id, client_secret } = config;

  if (!account_id || !client_id || !client_secret) {
    throw new Error('Missing Zoom credentials in integration config');
  }

  console.log('Getting Zoom access token from integration config...');
  const authHeader = btoa(`${client_id}:${client_secret}`);
  
  const tokenResponse = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=account_credentials&account_id=${account_id}`,
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
  const timeParts = scheduledTime.split(':');
  const hours = parseInt(timeParts[0], 10);
  const minutes = parseInt(timeParts[1], 10);
  const startTime = `${scheduledDate}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;

  console.log('Creating Zoom meeting:', {
    topic: `1:1 Call with ${customerName}`,
    start_time_ist: startTime,
    duration: 90,
  });

  const meetingResponse = await fetch('https://api.zoom.us/v2/users/me/meetings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topic: `1:1 Call with ${customerName}`,
      type: 2,
      start_time: startTime,
      duration: 90,
      timezone: 'Asia/Kolkata',
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        mute_upon_entry: false,
        watermark: false,
        use_pmi: false,
        approval_type: 2,
        audio: 'both',
        auto_recording: 'cloud',
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

// Helper function to get Calendly user URI
async function getCalendlyUserUri(token: string): Promise<string | null> {
  try {
    const response = await fetch('https://api.calendly.com/users/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      console.error('Failed to get Calendly user:', await response.text());
      return null;
    }
    
    const data = await response.json();
    return data.resource?.uri || null;
  } catch (error) {
    console.error('Error fetching Calendly user:', error);
    return null;
  }
}

// Helper function to get Calendly event type URI - PRIORITY: "Direct" > full closer name > first active
async function getCalendlyEventTypeUri(token: string, userUri: string, closerName: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.calendly.com/event_types?user=${encodeURIComponent(userUri)}&active=true`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    if (!response.ok) {
      console.error('Failed to get Calendly event types:', await response.text());
      return null;
    }
    
    const data = await response.json();
    const eventTypes = data.collection || [];
    
    console.log('Available Calendly event types:', eventTypes.map((e: { name: string; uri: string }) => ({ name: e.name, uri: e.uri })));
    
    // PRIORITY 1: Event type with "Direct" in name (preferred for rebooking)
    const directEventType = eventTypes.find((e: { name: string }) => 
      e.name.toLowerCase().includes('direct')
    );
    if (directEventType) {
      console.log('Selected event type by DIRECT priority:', directEventType.name);
      return directEventType.uri;
    }
    
    // PRIORITY 2: Event type with full closer name (e.g., "Dipanshu Malasi")
    const closerNameLower = closerName.toLowerCase();
    const closerNameParts = closerNameLower.split(' ');
    const closerLastName = closerNameParts.length > 1 ? closerNameParts[closerNameParts.length - 1] : '';
    
    const closerNameEventType = eventTypes.find((e: { name: string }) => {
      const nameLower = e.name.toLowerCase();
      return nameLower.includes(closerNameLower) || 
             (closerLastName && nameLower.includes(closerLastName));
    });
    if (closerNameEventType) {
      console.log('Selected event type by closer name:', closerNameEventType.name);
      return closerNameEventType.uri;
    }
    
    // PRIORITY 3: Fallback to first active event type
    console.log('No priority match found, using first event type:', eventTypes[0]?.name);
    return eventTypes[0]?.uri || null;
  } catch (error) {
    console.error('Error fetching Calendly event types:', error);
    return null;
  }
}

// Helper function to get Calendly event type custom questions with positions
interface CalendlyCustomQuestion {
  name: string;
  type: string;
  position: number;
  required: boolean;
  answer_choices?: string[];
}

async function getCalendlyEventTypeQuestions(token: string, eventTypeUri: string): Promise<CalendlyCustomQuestion[]> {
  try {
    const response = await fetch(eventTypeUri, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      console.error('Failed to get Calendly event type details:', await response.text());
      return [];
    }
    
    const data = await response.json();
    const questions = data.resource?.custom_questions || [];
    console.log('Calendly custom questions:', JSON.stringify(questions, null, 2));
    return questions;
  } catch (error) {
    console.error('Error fetching Calendly event type questions:', error);
    return [];
  }
}

// Build questions_and_answers dynamically based on event type questions
function buildQuestionsAndAnswers(
  questions: CalendlyCustomQuestion[], 
  phoneNumber: string
): Array<{ question: string; answer: string; position: number }> {
  const answers: Array<{ question: string; answer: string; position: number }> = [];
  
  for (const q of questions) {
    const questionLower = q.name.toLowerCase();
    let answer = '';
    
    if (questionLower.includes('phone') || questionLower.includes('mobile') || questionLower.includes('number')) {
      answer = phoneNumber;
    } else if (q.type === 'single_select' && q.answer_choices && q.answer_choices.length > 0) {
      answer = q.answer_choices[0];
    } else {
      answer = 'null';
    }
    
    answers.push({
      question: q.name,
      answer: answer,
      position: q.position
    });
  }
  
  console.log('Built questions_and_answers:', JSON.stringify(answers, null, 2));
  return answers;
}

// Helper function to cancel existing Calendly event
async function cancelCalendlyEvent(token: string, eventUri: string): Promise<boolean> {
  try {
    const eventUuid = eventUri.split('/').pop();
    if (!eventUuid) return false;
    
    const response = await fetch(
      `https://api.calendly.com/scheduled_events/${eventUuid}/cancellation`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: 'Rescheduled via CRM'
        })
      }
    );
    
    if (!response.ok) {
      console.error('Failed to cancel Calendly event:', await response.text());
      return false;
    }
    
    console.log('Successfully cancelled old Calendly event:', eventUuid);
    return true;
  } catch (error) {
    console.error('Error cancelling Calendly event:', error);
    return false;
  }
}

// Helper function to create Calendly invitee (book meeting)
async function createCalendlyInvitee(
  token: string, 
  eventTypeUri: string, 
  startTimeUtc: string, 
  inviteeName: string, 
  inviteeEmail: string,
  questionsAndAnswers: Array<{ question: string; answer: string; position: number }>
): Promise<{ success: boolean; zoomLink?: string; eventUri?: string; error?: string }> {
  try {
    console.log('Creating Calendly invitee with:', {
      eventTypeUri,
      startTimeUtc,
      inviteeName,
      inviteeEmail,
      questionsAndAnswers
    });
    
    const response = await fetch('https://api.calendly.com/invitees', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event_type: eventTypeUri,
        start_time: startTimeUtc,
        invitee: {
          name: inviteeName,
          email: inviteeEmail,
          timezone: 'Asia/Kolkata'
        },
        location: {
          kind: 'zoom_conference'
        },
        questions_and_answers: questionsAndAnswers
      })
    });
    
    const responseText = await response.text();
    console.log('Calendly invitee response status:', response.status);
    console.log('Calendly invitee response:', responseText);
    
    if (!response.ok) {
      return { success: false, error: responseText };
    }
    
    const data = JSON.parse(responseText);
    const zoomLink = data.resource?.scheduled_event?.location?.join_url;
    const eventUri = data.resource?.event;
    
    return { success: true, zoomLink, eventUri };
  } catch (error) {
    console.error('Error creating Calendly invitee:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Helper function to get closer's integration from database
// deno-lint-ignore no-explicit-any
async function getCloserIntegration(
  supabaseClient: any,
  closerId: string,
  organizationId: string
): Promise<{ integrationType: string | null; config: ZoomConfig | CalendlyConfig | null }> {
  const { data, error } = await supabaseClient
    .from('closer_integrations')
    .select(`
      integration_id,
      organization_integrations!inner(integration_type, config, is_active)
    `)
    .eq('closer_id', closerId)
    .eq('organization_id', organizationId)
    .eq('organization_integrations.is_active', true)
    .maybeSingle();

  if (error || !data) {
    console.log('No integration found for closer:', closerId);
    return { integrationType: null, config: null };
  }

  // Type assertion with proper handling
  const orgIntegration = (data as Record<string, unknown>).organization_integrations as { 
    integration_type: string; 
    config: Record<string, unknown> 
  } | undefined;

  if (!orgIntegration) {
    return { integrationType: null, config: null };
  }

  return {
    integrationType: orgIntegration.integration_type,
    config: orgIntegration.config as unknown as ZoomConfig | CalendlyConfig
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const aisensyApiKey = Deno.env.get('AISENSY_API_KEY');
    const aisensySource = Deno.env.get('AISENSY_SOURCE');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { appointment_id, new_date, new_time } = await req.json();

    console.log('Rebook call request:', { appointment_id, new_date, new_time });

    // Validate required fields
    if (!appointment_id || !new_date || !new_time) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: appointment_id, new_date, new_time' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch current appointment with lead and closer details
    const { data: appointment, error: appointmentError } = await supabase
      .from('call_appointments')
      .select(`
        *,
        lead:leads(id, contact_name, email, phone, country),
        closer:profiles!call_appointments_closer_id_fkey(id, full_name, email)
      `)
      .eq('id', appointment_id)
      .single();

    if (appointmentError || !appointment) {
      console.error('Appointment not found:', appointmentError);
      return new Response(
        JSON.stringify({ error: 'Appointment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lead = appointment.lead;
    const closer = appointment.closer;

    if (!lead) {
      return new Response(
        JSON.stringify({ error: 'Lead not found for this appointment' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Rebooking call for:', lead.contact_name, '| Closer:', closer?.full_name);

    // Get closer's integration from database
    const closerIntegration = appointment.closer_id 
      ? await getCloserIntegration(supabase, appointment.closer_id, appointment.organization_id)
      : { integrationType: null, config: null };
    
    const useCalendly = closerIntegration.integrationType === 'calendly';
    const useZoom = closerIntegration.integrationType === 'zoom';

    console.log('Closer integration:', {
      closerName: closer?.full_name,
      integrationType: closerIntegration.integrationType,
      useCalendly,
      useZoom
    });

    let calendlySynced = false;
    let calendlyError: string | null = null;
    let newZoomLink: string | null = null;
    let newCalendlyEventUri: string | null = null;

    // Calendly integration
    if (useCalendly && closerIntegration.config) {
      console.log(`Closer ${closer?.full_name} uses Calendly - initiating API integration`);
      
      const calendlyConfig = closerIntegration.config as CalendlyConfig;
      const calendlyToken = calendlyConfig.api_token;
      
      if (!calendlyToken) {
        console.error('Missing Calendly token for closer:', closer?.full_name);
        calendlyError = 'Missing Calendly token';
      } else {
        // Step 1: Get Calendly user URI
        const userUri = await getCalendlyUserUri(calendlyToken);
        
        if (!userUri) {
          calendlyError = 'Failed to get Calendly user';
        } else {
          console.log('Calendly user URI:', userUri);
          
          // Step 2: Get event type URI (pass closer name for better matching)
          const eventTypeUri = await getCalendlyEventTypeUri(calendlyToken, userUri, closer?.full_name || '');
          
          if (!eventTypeUri) {
            calendlyError = 'Failed to get Calendly event type';
          } else {
            console.log('Calendly event type URI:', eventTypeUri);
            
            // Step 3: Cancel old Calendly event if exists
            if (appointment.calendly_event_uri) {
              console.log('Cancelling old Calendly event:', appointment.calendly_event_uri);
              await cancelCalendlyEvent(calendlyToken, appointment.calendly_event_uri);
            }
            
            // Step 4: Convert IST date/time to UTC ISO format
            const timeNormalized = new_time.split(':').slice(0, 2).join(':');
            const istDateTime = new Date(`${new_date}T${timeNormalized}:00+05:30`);
            const startTimeUtc = istDateTime.toISOString();
            console.log('Start time UTC:', startTimeUtc);
            
            // Step 5: Get event type questions and build answers dynamically
            const customerPhone = lead.phone?.replace(/\D/g, '') || '';
            const countryCode = lead.country?.replace(/\D/g, '') || '91';
            const phoneWithCountry = customerPhone.startsWith(countryCode) ? customerPhone : `${countryCode}${customerPhone}`;
            
            const customQuestions = await getCalendlyEventTypeQuestions(calendlyToken, eventTypeUri);
            const questionsAndAnswers = buildQuestionsAndAnswers(customQuestions, phoneWithCountry);
            
            // Step 6: Create new Calendly invitee
            const inviteeResult = await createCalendlyInvitee(
              calendlyToken,
              eventTypeUri,
              startTimeUtc,
              lead.contact_name,
              lead.email,
              questionsAndAnswers
            );
            
            if (inviteeResult.success) {
              calendlySynced = true;
              newZoomLink = inviteeResult.zoomLink || null;
              newCalendlyEventUri = inviteeResult.eventUri || null;
              console.log('Calendly event created successfully');
              console.log('New Zoom link:', newZoomLink);
              console.log('New Calendly event URI:', newCalendlyEventUri);
            } else {
              calendlyError = inviteeResult.error || 'Failed to create Calendly event';
              console.error('Calendly invitee creation failed:', calendlyError);
            }
          }
        }
      }
    } else if (useZoom && closerIntegration.config) {
      // Zoom integration (not Calendly)
      console.log('Closer uses Zoom - creating new Zoom meeting for rebooked call');
      
      try {
        const zoomConfig = closerIntegration.config as ZoomConfig;
        const accessToken = await getZoomAccessToken(zoomConfig);
        const meeting = await createZoomMeeting(
          accessToken,
          lead.contact_name,
          new_date,
          new_time
        );
        
        if (meeting.join_url) {
          newZoomLink = meeting.join_url;
          console.log('New Zoom link created:', newZoomLink);
        }
      } catch (zoomError) {
        console.error('Error creating Zoom meeting:', zoomError);
      }
    } else {
      console.log('Closer does not have any integration configured, skipping meeting creation');
    }

    // CRITICAL: If Calendly was required but failed, return error - don't update appointment
    if (useCalendly && !calendlySynced) {
      console.error('Calendly sync failed, not updating appointment:', calendlyError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: calendlyError || 'Failed to create Calendly event',
          calendly: {
            synced: false,
            error: calendlyError
          }
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save previous schedule and update appointment
    const updateData: Record<string, unknown> = {
      previous_scheduled_date: appointment.scheduled_date,
      previous_scheduled_time: appointment.scheduled_time,
      scheduled_date: new_date,
      scheduled_time: new_time,
      status: 'scheduled',
      was_rescheduled: true,
      rescheduled_at: new Date().toISOString(),
      last_rebooked_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Add Calendly data if synced
    if (calendlySynced) {
      if (newZoomLink) updateData.zoom_link = newZoomLink;
      if (newCalendlyEventUri) updateData.calendly_event_uri = newCalendlyEventUri;
    }
    
    // Add Zoom link for Zoom-only closers (not Calendly)
    if (!calendlySynced && newZoomLink) {
      updateData.zoom_link = newZoomLink;
    }

    const { error: updateError } = await supabase
      .from('call_appointments')
      .update(updateData)
      .eq('id', appointment_id);

    if (updateError) {
      console.error('Error updating appointment:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update appointment', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Appointment updated successfully');
    console.log('Reminders will be recalculated automatically by database trigger');

    // Send WhatsApp confirmation message
    let whatsappSent = false;
    let whatsappError = null;

    if (aisensyApiKey && aisensySource && lead.phone) {
      try {
        const customerPhone = lead.phone.replace(/\D/g, '');
        const phoneWithCountry = customerPhone.startsWith('91') ? customerPhone : `91${customerPhone}`;

        const callDate = new Date(new_date);
        const formattedDate = callDate.toLocaleDateString('en-IN', { 
          day: 'numeric', 
          month: 'long' 
        });
        
        const [hours, minutes] = new_time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        const formattedTime = `${hour12}:${minutes} ${ampm} IST`;

        const templateParams = [
          lead.contact_name,
          'Our Crypto Expert',
          formattedDate,
          formattedTime,
          newZoomLink || 'you will get zoom link 30 minutes before the zoom call',
          '+919266395637',
        ];

        console.log('Sending WhatsApp confirmation:', {
          phone: phoneWithCountry,
          template: BOOKING_TEMPLATE,
          params: templateParams,
        });

        const whatsappPayload = {
          apiKey: aisensyApiKey,
          campaignName: BOOKING_TEMPLATE,
          destination: phoneWithCountry,
          userName: 'Crypto Call',
          source: aisensySource,
          templateParams,
          media: {
            url: VIDEO_URL,
            filename: 'booking.mp4',
          },
        };

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
        if (!whatsappResponse.ok) {
          whatsappError = whatsappResult;
        }

        // Update the call_booked reminder status to 'sent'
        const { error: reminderUpdateError } = await supabase
          .from('call_reminders')
          .update({ 
            status: 'sent', 
            sent_at: new Date().toISOString() 
          })
          .eq('appointment_id', appointment_id)
          .eq('reminder_type', 'call_booked');

        if (reminderUpdateError) {
          console.error('Error updating call_booked reminder:', reminderUpdateError);
        }

      } catch (error) {
        console.error('Error sending WhatsApp:', error);
        whatsappError = error instanceof Error ? error.message : 'Unknown error';
      }
    } else {
      console.log('WhatsApp not sent - missing AiSensy config or phone number');
    }

    // Send notification to Kamal (call booker) if Calendly was used
    let kamalNotificationSent = false;
    if (useCalendly && aisensyApiKey && aisensySource) {
      console.log('Sending notification to Kamal for rebooked Calendly call');
      
      try {
        const callDate = new Date(new_date);
        const kamalFormattedDate = `${callDate.getDate()} ${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][callDate.getMonth()]}`;
        
        const [kamalHours, kamalMinutes] = new_time.split(':').map(Number);
        const kamalPeriod = kamalHours >= 12 ? 'PM' : 'AM';
        const kamalDisplayHours = kamalHours % 12 || 12;
        const kamalFormattedTime = `${kamalDisplayHours}:${kamalMinutes.toString().padStart(2, '0')} ${kamalPeriod}`;
        
        const leadPhone = (lead.phone || '').replace(/\D/g, '');
        const leadNameWithPhone = leadPhone ? `${lead.contact_name} (+${leadPhone})` : lead.contact_name;
        
        const kamalPayload = {
          apiKey: aisensyApiKey,
          campaignName: '1_to_1_call_booking',
          destination: KAMAL_PHONE,
          userName: KAMAL_NAME,
          source: aisensySource,
          templateParams: [
            KAMAL_NAME,
            leadNameWithPhone,
            kamalFormattedDate,
            kamalFormattedTime,
          ],
        };
        
        console.log('Kamal notification payload:', JSON.stringify(kamalPayload, null, 2));
        
        const kamalResponse = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(kamalPayload),
        });
        
        const kamalResult = await kamalResponse.json();
        console.log('Kamal notification response:', kamalResult);
        kamalNotificationSent = kamalResponse.ok;
      } catch (kamalError) {
        console.error('Error sending notification to Kamal:', kamalError);
      }
    }

    // Send notification to the closer about the rebooked call
    let closerNotificationSent = false;
    if (aisensyApiKey && aisensySource) {
      console.log('Sending notification to closer for rebooked call');
      
      try {
        const closerNotificationResponse = await fetch(
          `${supabaseUrl}/functions/v1/send-closer-notification`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ appointment_id }),
          }
        );
        
        const closerNotificationResult = await closerNotificationResponse.json();
        console.log('Closer notification response:', closerNotificationResult);
        closerNotificationSent = closerNotificationResponse.ok;
      } catch (closerError) {
        console.error('Error sending notification to closer:', closerError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Call rebooked successfully',
        appointment: {
          id: appointment_id,
          lead_name: lead.contact_name,
          closer_name: closer?.full_name || 'Unknown',
          previous_date: appointment.scheduled_date,
          previous_time: appointment.scheduled_time,
          new_date,
          new_time,
        },
        whatsapp: {
          sent: whatsappSent,
          error: whatsappError,
        },
        calendly: {
          synced: calendlySynced,
          zoom_link: newZoomLink,
          error: calendlyError,
        },
        integrationType: closerIntegration.integrationType,
        kamal_notification_sent: kamalNotificationSent,
        closer_notification_sent: closerNotificationSent,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in rebook-call:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
