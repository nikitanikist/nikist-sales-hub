import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Template mapping for Dipanshu's reminders
const DIPANSHU_TEMPLATE_MAP: Record<string, { name: string; isVideo: boolean }> = {
  'call_booked': { name: '1_to_1_call_booking_crypto_dipanshu', isVideo: true },
  'two_days': { name: 'cryptoreminder2days', isVideo: false },
  'one_day': { name: 'cryptoreminder1days', isVideo: false },
  'three_hours': { name: 'cryptoreminder3hrs', isVideo: false },
  'one_hour': { name: 'cryptoreminder1hr', isVideo: false },
  'thirty_minutes': { name: 'cryptoreminder30min', isVideo: false },
  'ten_minutes': { name: 'cryptoreminder10min', isVideo: false },
  'we_are_live': { name: '1_1_live', isVideo: false },
};

// Template mapping for Akansha's reminders
// Booking confirmation uses different template, but reminders are same as Dipanshu
const AKANSHA_TEMPLATE_MAP: Record<string, { name: string; isVideo: boolean }> = {
  'call_booked': { name: '1_to_1_call_booking_crypto_nikist_video', isVideo: true },
  'two_days': { name: 'cryptoreminder2days', isVideo: false },
  'one_day': { name: 'cryptoreminder1days', isVideo: false },
  'three_hours': { name: 'cryptoreminder3hrs', isVideo: false },
  'one_hour': { name: 'cryptoreminder1hr', isVideo: false },
  'thirty_minutes': { name: 'cryptoreminder30min', isVideo: false },
  'ten_minutes': { name: 'cryptoreminder10min', isVideo: false },
  'we_are_live': { name: '1_1_live', isVideo: false },
};

const DIPANSHU_VIDEO_URL = 'https://d3jt6ku4g6z5l8.cloudfront.net/VIDEO/66f4f03f444c5c0b8013168b/227807_Updated 11.mp4';
const AKANSHA_VIDEO_URL = 'https://d3jt6ku4g6z5l8.cloudfront.net/VIDEO/66f4f03f444c5c0b8013168b/5384969_1706706new video 1 14.mp4';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const aisensyApiKey = Deno.env.get('AISENSY_API_KEY');
    const aisensySource = Deno.env.get('AISENSY_SOURCE');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!aisensyApiKey || !aisensySource) {
      console.error('Missing AiSensy configuration');
      return new Response(
        JSON.stringify({ error: 'Missing AiSensy configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
    const { reminder_id } = await req.json();

    console.log('Processing reminder:', reminder_id);

    // Fetch reminder with appointment and lead details
    const { data: reminder, error: reminderError } = await supabase
      .from('call_reminders')
      .select(`
        *,
        appointment:call_appointments(
          *,
          lead:leads(*),
          closer:profiles!call_appointments_closer_id_fkey(*)
        )
      `)
      .eq('id', reminder_id)
      .single();

    if (reminderError || !reminder) {
      console.error('Reminder fetch error:', reminderError);
      return new Response(
        JSON.stringify({ error: 'Reminder not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const appointment = reminder.appointment;
    const lead = appointment?.lead;
    const closer = appointment?.closer;

    if (!lead || !appointment) {
      console.error('Missing appointment or lead data');
      return new Response(
        JSON.stringify({ error: 'Missing appointment or lead data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check who is the closer
    const isDipanshu = closer?.email?.toLowerCase() === 'nikistofficial@gmail.com';
    const isAkansha = closer?.email?.toLowerCase() === 'akanshanikist@gmail.com';
    const isAdesh = closer?.email?.toLowerCase() === 'aadeshnikist@gmail.com';
    
    // Only process reminders for Dipanshu, Akansha, or Adesh
    if (!isDipanshu && !isAkansha && !isAdesh) {
      console.log('Not Dipanshu, Akansha, or Adesh closer, skipping WhatsApp');
      // Mark as sent anyway to prevent re-processing
      await supabase
        .from('call_reminders')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', reminder_id);
      
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'Not Dipanshu, Akansha, or Adesh closer' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Select appropriate template map and video URL based on closer
    // Adesh uses same templates as Akansha
    const templateMap = isDipanshu ? DIPANSHU_TEMPLATE_MAP : AKANSHA_TEMPLATE_MAP;
    const videoUrl = isDipanshu ? DIPANSHU_VIDEO_URL : AKANSHA_VIDEO_URL;

    const template = templateMap[reminder.reminder_type];
    if (!template) {
      console.error('Unknown reminder type:', reminder.reminder_type);
      return new Response(
        JSON.stringify({ error: 'Unknown reminder type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format customer phone
    const customerPhone = lead.phone?.replace(/\D/g, '') || '';
    const phoneWithCountry = customerPhone.startsWith('91') ? customerPhone : `91${customerPhone}`;

    // Format date and time
    const callDate = new Date(appointment.scheduled_date);
    const formattedDate = callDate.toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'long' 
    });
    
    const [hours, minutes] = appointment.scheduled_time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    const formattedTime = `${hour12}:${minutes} ${ampm} IST`;
    const dateTimeCombo = `${formattedDate}, ${formattedTime}`;

    // Build template params based on reminder type and closer
    let templateParams: string[] = [];
    
    switch (reminder.reminder_type) {
      case 'call_booked':
        if (isDipanshu) {
          // Dipanshu: 5 params
          templateParams = [
            lead.contact_name,
            formattedDate,
            formattedTime,
            'Zoom link will be shared 10 minutes before the call',
            '+919266395637',
          ];
        } else {
          // Akansha: 6 params
          templateParams = [
            lead.contact_name,
            'Our Crypto Expert',
            formattedDate,
            formattedTime,
            'you will get zoom link 30 minutes before the zoom call',
            '+919266395637',
          ];
        }
        break;
      case 'two_days':
      case 'one_day':
        templateParams = [
          lead.contact_name,
          formattedDate,
          formattedTime,
        ];
        break;
      case 'three_hours':
        templateParams = [
          lead.contact_name,
          dateTimeCombo,
        ];
        break;
      case 'one_hour':
        templateParams = [
          lead.contact_name,
          formattedTime,
        ];
        break;
      case 'thirty_minutes':
        templateParams = [
          formattedTime,
        ];
        break;
      case 'ten_minutes':
        templateParams = [
          lead.contact_name,
          appointment.zoom_link || 'Link will be shared shortly',
        ];
        break;
      case 'we_are_live':
        templateParams = [
          lead.contact_name,
          'One-to-one call with our crypto expert',
          appointment.zoom_link || 'Link will be shared shortly',
        ];
        break;
    }

    console.log('Sending WhatsApp:', {
      closer: isDipanshu ? 'Dipanshu' : 'Akansha',
      template: template.name,
      phone: phoneWithCountry,
      params: templateParams,
    });

    // Build WhatsApp payload
    const whatsappPayload: any = {
      apiKey: aisensyApiKey,
      campaignName: template.name,
      destination: phoneWithCountry,
      userName: 'Crypto Call',
      source: aisensySource,
      templateParams,
    };

    // Add media for video templates
    if (template.isVideo) {
      whatsappPayload.media = {
        url: videoUrl,
        filename: 'reminder.mp4',
      };
    }

    // Send WhatsApp message
    const whatsappResponse = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(whatsappPayload),
    });

    const whatsappResult = await whatsappResponse.json();
    console.log('WhatsApp API response:', whatsappResult);

    // Update reminder status
    const newStatus = whatsappResponse.ok ? 'sent' : 'failed';
    await supabase
      .from('call_reminders')
      .update({ 
        status: newStatus, 
        sent_at: new Date().toISOString() 
      })
      .eq('id', reminder_id);

    return new Response(
      JSON.stringify({ 
        success: whatsappResponse.ok, 
        status: newStatus,
        closer: isDipanshu ? 'Dipanshu' : (isAdesh ? 'Adesh' : 'Akansha'),
        whatsapp_response: whatsappResult,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-whatsapp-reminder:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
