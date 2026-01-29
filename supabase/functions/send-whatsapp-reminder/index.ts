import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default template mapping (fallback if not in org config)
const DEFAULT_TEMPLATE_MAP: Record<string, { name: string; isVideo: boolean }> = {
  'call_booked': { name: '1_to_1_call_booking_crypto_nikist_video', isVideo: true },
  'two_days': { name: 'cryptoreminder2days', isVideo: false },
  'one_day': { name: 'cryptoreminder1days', isVideo: false },
  'three_hours': { name: 'cryptoreminder3hrs', isVideo: false },
  'one_hour': { name: 'cryptoreminder1hr', isVideo: false },
  'thirty_minutes': { name: 'cryptoreminder30min', isVideo: false },
  'ten_minutes': { name: 'cryptoreminder10min', isVideo: false },
  'we_are_live': { name: '1_1_live', isVideo: false },
};

const DEFAULT_VIDEO_URL = 'https://d3jt6ku4g6z5l8.cloudfront.net/VIDEO/66f4f03f444c5c0b8013168b/5384969_1706706new video 1 14.mp4';

interface WhatsAppConfig {
  api_key: string;
  source: string;
  templates?: Record<string, { name: string; isVideo: boolean }>;
  video_url?: string;
  support_number?: string;
}

serve(async (req) => {
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
    const { reminder_id } = await req.json();

    console.log('Processing reminder:', reminder_id);

    // Fetch reminder with appointment, lead, and organization details
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

    // Get WhatsApp integration for this organization
    const { data: whatsappIntegration, error: integrationError } = await supabase
      .from('organization_integrations')
      .select('config')
      .eq('organization_id', appointment.organization_id)
      .eq('integration_type', 'whatsapp')
      .eq('is_active', true)
      .maybeSingle();

    if (integrationError) {
      console.error('Error fetching WhatsApp integration:', integrationError);
    }

    // Use org integration config or fallback to env variables
    let whatsappConfig: WhatsAppConfig;
    
    if (whatsappIntegration?.config) {
      whatsappConfig = whatsappIntegration.config as WhatsAppConfig;
    } else {
      // Fallback to environment variables for backwards compatibility
      const aisensyApiKey = Deno.env.get('AISENSY_API_KEY');
      const aisensySource = Deno.env.get('AISENSY_SOURCE');
      
      if (!aisensyApiKey || !aisensySource) {
        console.log('No WhatsApp integration configured, skipping reminder');
        // Mark as sent to prevent re-processing
        await supabase
          .from('call_reminders')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', reminder_id);
        
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: 'No WhatsApp integration configured' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      whatsappConfig = {
        api_key: aisensyApiKey,
        source: aisensySource,
      };
    }

    // Check if closer has WhatsApp integration mapped
    const { data: closerIntegration } = await supabase
      .from('closer_integrations')
      .select('integration_id, organization_integrations!inner(config)')
      .eq('closer_id', appointment.closer_id)
      .eq('organization_id', appointment.organization_id)
      .maybeSingle();

    // If closer has specific integration, use those templates
    if (closerIntegration?.organization_integrations) {
      const closerConfig = (closerIntegration.organization_integrations as any).config as WhatsAppConfig;
      if (closerConfig?.templates) {
        whatsappConfig.templates = closerConfig.templates;
      }
      if (closerConfig?.video_url) {
        whatsappConfig.video_url = closerConfig.video_url;
      }
    }

    // Get template for this reminder type
    const templateMap = whatsappConfig.templates || DEFAULT_TEMPLATE_MAP;
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

    const supportNumber = whatsappConfig.support_number || '+919266395637';

    // Build template params based on reminder type
    let templateParams: string[] = [];
    
    switch (reminder.reminder_type) {
      case 'call_booked':
        templateParams = [
          lead.contact_name,
          'Our Crypto Expert',
          formattedDate,
          formattedTime,
          'you will get zoom link 30 minutes before the zoom call',
          supportNumber,
        ];
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
      closer: closer?.full_name,
      template: template.name,
      phone: phoneWithCountry,
      params: templateParams,
    });

    // Build WhatsApp payload
    const whatsappPayload: any = {
      apiKey: whatsappConfig.api_key,
      campaignName: template.name,
      destination: phoneWithCountry,
      userName: 'Crypto Call',
      source: whatsappConfig.source,
      templateParams,
    };

    // Add media for video templates
    if (template.isVideo) {
      whatsappPayload.media = {
        url: whatsappConfig.video_url || DEFAULT_VIDEO_URL,
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
        closer: closer?.full_name,
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
