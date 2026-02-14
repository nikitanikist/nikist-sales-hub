import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { fetchWithRetry, fetchWithTimeout } from '../_shared/fetchWithRetry.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// deno-lint-ignore no-explicit-any
async function validateAuth(req: Request, supabase: any): Promise<{ valid: boolean; error?: string; userId?: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing or invalid authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    return { valid: false, error: 'Invalid or expired token' };
  }

  const { data: membership, error: memberError } = await supabase
    .from('organization_members')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (memberError || !membership) {
    return { valid: false, error: 'Unauthorized: User is not a member of any organization' };
  }

  return { valid: true, userId: user.id };
}

const BOOKING_TEMPLATE = '1_to_1_call_booking_crypto_nikist_video';
const VIDEO_URL = 'https://d3jt6ku4g6z5l8.cloudfront.net/VIDEO/66f4f03f444c5c0b8013168b/5384969_1706706new video 1 14.mp4';

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

async function getZoomAccessToken(config: ZoomConfig): Promise<string> {
  const { account_id, client_id, client_secret } = config;

  if (!account_id || !client_id || !client_secret) {
    throw new Error('Missing Zoom credentials in integration config');
  }

  console.log('Getting Zoom access token from integration config...');
  const authHeader = btoa(`${client_id}:${client_secret}`);
  
  const tokenResponse = await fetchWithRetry('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=account_credentials&account_id=${account_id}`,
  }, { timeoutMs: 15000 });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('Zoom token error:', errorText);
    throw new Error(`Failed to get Zoom access token: ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  console.log('Zoom access token obtained successfully');
  return tokenData.access_token;
}

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

  const meetingResponse = await fetchWithRetry('https://api.zoom.us/v2/users/me/meetings', {
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
  }, { timeoutMs: 15000 });

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

async function getCalendlyUserUri(token: string): Promise<string | null> {
  try {
    const response = await fetchWithTimeout('https://api.calendly.com/users/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    }, 15000);
    
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

async function getCalendlyEventTypeUri(token: string, userUri: string, closerName: string): Promise<string | null> {
  try {
    const response = await fetchWithTimeout(
      `https://api.calendly.com/event_types?user=${encodeURIComponent(userUri)}&active=true`,
      { headers: { 'Authorization': `Bearer ${token}` } },
      15000
    );
    
    if (!response.ok) {
      console.error('Failed to get Calendly event types:', await response.text());
      return null;
    }
    
    const data = await response.json();
    const eventTypes = data.collection || [];
    
    console.log('Available Calendly event types:', eventTypes.map((e: { name: string; uri: string }) => ({ name: e.name, uri: e.uri })));
    
    const directEventType = eventTypes.find((e: { name: string }) => 
      e.name.toLowerCase().includes('direct')
    );
    if (directEventType) {
      console.log('Selected event type by DIRECT priority:', directEventType.name);
      return directEventType.uri;
    }
    
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
    
    console.log('No priority match found, using first event type:', eventTypes[0]?.name);
    return eventTypes[0]?.uri || null;
  } catch (error) {
    console.error('Error fetching Calendly event types:', error);
    return null;
  }
}

interface CalendlyCustomQuestion {
  name: string;
  type: string;
  position: number;
  required: boolean;
  answer_choices?: string[];
}

async function getCalendlyEventTypeQuestions(token: string, eventTypeUri: string): Promise<CalendlyCustomQuestion[]> {
  try {
    const response = await fetchWithTimeout(eventTypeUri, {
      headers: { 'Authorization': `Bearer ${token}` }
    }, 15000);
    
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

async function cancelCalendlyEvent(token: string, eventUri: string): Promise<boolean> {
  try {
    const eventUuid = eventUri.split('/').pop();
    if (!eventUuid) return false;
    
    const response = await fetchWithTimeout(
      `https://api.calendly.com/scheduled_events/${eventUuid}/cancellation`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: 'Reassigned to another closer via CRM'
        })
      },
      15000
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
    
    const response = await fetchWithTimeout('https://api.calendly.com/invitees', {
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
    }, 15000);
    
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const aisensyApiKey = Deno.env.get('AISENSY_API_KEY');
    const aisensySource = Deno.env.get('AISENSY_SOURCE');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authResult = await validateAuth(req, supabase);
    if (!authResult.valid) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { appointment_id, new_closer_id, new_date, new_time } = await req.json();

    console.log('Reassign call request:', { appointment_id, new_closer_id, new_date, new_time, requestedBy: authResult.userId });

    if (!appointment_id || !new_closer_id || !new_date || !new_time) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: appointment_id, new_closer_id, new_date, new_time' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: appointment, error: appointmentError } = await supabase
      .from('call_appointments')
      .select(`
        *,
        lead:leads(id, contact_name, email, phone, country, assigned_to, previous_assigned_to),
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

    const { data: newCloser, error: newCloserError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', new_closer_id)
      .single();

    if (newCloserError || !newCloser) {
      console.error('New closer not found:', newCloserError);
      return new Response(
        JSON.stringify({ error: 'New closer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lead = appointment.lead;
    const oldCloser = appointment.closer;

    if (!lead) {
      return new Response(
        JSON.stringify({ error: 'Lead not found for this appointment' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Reassigning call:', {
      from: oldCloser?.full_name,
      to: newCloser.full_name,
      lead: lead.contact_name
    });

    const oldDate = appointment.scheduled_date;
    const oldTime = appointment.scheduled_time?.slice(0, 5);
    const newTimeNormalized = new_time.slice(0, 5);
    const dateTimeChanged = oldDate !== new_date || oldTime !== newTimeNormalized;

    console.log('DateTime comparison:', {
      oldDate,
      newDate: new_date,
      oldTime,
      newTime: newTimeNormalized,
      dateTimeChanged
    });

    const newCloserIntegration = await getCloserIntegration(supabase, new_closer_id, appointment.organization_id);
    const useCalendly = newCloserIntegration.integrationType === 'calendly';
    const useZoom = newCloserIntegration.integrationType === 'zoom';

    console.log('New closer integration:', {
      closerName: newCloser.full_name,
      integrationType: newCloserIntegration.integrationType,
      useCalendly,
      useZoom
    });

    let newZoomLink: string | null = null;
    let newCalendlyEventUri: string | null = null;
    let calendlySynced = false;

    // Cancel old Calendly event if needed
    if (appointment.closer_id && appointment.calendly_event_uri) {
      const oldCloserIntegration = await getCloserIntegration(supabase, appointment.closer_id, appointment.organization_id);
      if (oldCloserIntegration.integrationType === 'calendly' && oldCloserIntegration.config) {
        const calendlyConfig = oldCloserIntegration.config as CalendlyConfig;
        if (calendlyConfig.api_token) {
          console.log('Cancelling old Calendly event from previous closer');
          await cancelCalendlyEvent(calendlyConfig.api_token, appointment.calendly_event_uri);
        }
      }
    }

    // Create new meeting based on new closer's integration type
    if (useCalendly && newCloserIntegration.config) {
      console.log(`New closer ${newCloser.full_name} uses Calendly - creating new event`);
      
      const calendlyConfig = newCloserIntegration.config as CalendlyConfig;
      const calendlyToken = calendlyConfig.api_token;
      
      if (calendlyToken) {
        const userUri = await getCalendlyUserUri(calendlyToken);
        
        if (userUri) {
          const eventTypeUri = await getCalendlyEventTypeUri(calendlyToken, userUri, newCloser.full_name || '');
          
          if (eventTypeUri) {
            const timeNormalized = new_time.split(':').slice(0, 2).join(':');
            const istDateTime = new Date(`${new_date}T${timeNormalized}:00+05:30`);
            const startTimeUtc = istDateTime.toISOString();
            
            const customerPhone = lead.phone?.replace(/\D/g, '') || '';
            const countryCode = lead.country?.replace(/\D/g, '') || '91';
            const phoneWithCountry = customerPhone.startsWith(countryCode) ? customerPhone : `${countryCode}${customerPhone}`;
            
            const customQuestions = await getCalendlyEventTypeQuestions(calendlyToken, eventTypeUri);
            const questionsAndAnswers = buildQuestionsAndAnswers(customQuestions, phoneWithCountry);
            
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
              console.log('Calendly event created successfully:', { newZoomLink, newCalendlyEventUri });
            } else {
              console.error('Calendly event creation failed:', inviteeResult.error);
            }
          }
        }
      }
    } else if (useZoom && newCloserIntegration.config) {
      console.log('New closer uses Zoom - creating Zoom meeting directly');
      
      try {
        const zoomConfig = newCloserIntegration.config as ZoomConfig;
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
      console.log('No integration configured for new closer, skipping meeting creation');
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      closer_id: new_closer_id,
      previous_closer_id: appointment.closer_id,
      was_rescheduled: true,
      updated_at: new Date().toISOString()
    };

    if (newZoomLink) {
      updateData.zoom_link = newZoomLink;
    }

    if (useCalendly && calendlySynced) {
      if (newCalendlyEventUri) updateData.calendly_event_uri = newCalendlyEventUri;
    } else {
      updateData.calendly_event_uri = null;
      updateData.calendly_invitee_uri = null;
    }

    if (dateTimeChanged) {
      updateData.previous_scheduled_date = appointment.scheduled_date;
      updateData.previous_scheduled_time = appointment.scheduled_time;
      updateData.scheduled_date = new_date;
      updateData.scheduled_time = new_time.length === 5 ? `${new_time}:00` : new_time;
      updateData.rescheduled_at = new Date().toISOString();
      updateData.status = 'scheduled';
    }

    console.log('Updating appointment with:', updateData);

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

    // Update lead's assigned_to
    const leadUpdateData: Record<string, unknown> = {
      previous_assigned_to: lead.assigned_to,
      assigned_to: new_closer_id,
      updated_at: new Date().toISOString()
    };

    const { error: leadUpdateError } = await supabase
      .from('leads')
      .update(leadUpdateData)
      .eq('id', lead.id);

    if (leadUpdateError) {
      console.error('Error updating lead assigned_to:', leadUpdateError);
    } else {
      console.log('Lead assigned_to updated successfully');
    }

    // Send WhatsApp confirmation ONLY if date/time changed
    let whatsappSent = false;
    let whatsappError = null;

    if (dateTimeChanged && aisensyApiKey && aisensySource && lead.phone) {
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

        console.log('Sending WhatsApp confirmation (date/time changed):', {
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

        const whatsappResponse = await fetchWithRetry('https://backend.aisensy.com/campaign/t1/api/v2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(whatsappPayload),
        }, { timeoutMs: 10000 });

        if (whatsappResponse.ok) {
          whatsappSent = true;
          console.log('WhatsApp confirmation sent successfully');
        } else {
          whatsappError = await whatsappResponse.text();
          console.error('WhatsApp send failed:', whatsappError);
        }
      } catch (error) {
        whatsappError = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error sending WhatsApp:', error);
      }
    } else if (!dateTimeChanged) {
      console.log('Date/time not changed - skipping WhatsApp notification');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Call reassigned successfully',
        dateTimeChanged,
        newCloser: newCloser.full_name,
        previousCloser: oldCloser?.full_name,
        newZoomLink,
        integrationType: newCloserIntegration.integrationType,
        whatsapp: {
          sent: whatsappSent,
          skipped: !dateTimeChanged,
          error: whatsappError
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Reassign call error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
