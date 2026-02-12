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
  templates?: Record<string, { name: string; isVideo: boolean } | string>;
  video_url?: string;
  support_number?: string;
  uses_env_secrets?: boolean;
  api_key_secret?: string;
  source_secret?: string;
}

// Resolve config values, handling the uses_env_secrets pattern
function resolveConfig(config: Record<string, unknown>): { api_key: string; source: string } {
  let api_key = '';
  let source = '';

  if (config.uses_env_secrets) {
    // Resolve from environment variables
    const apiKeySecretName = config.api_key_secret as string;
    const sourceSecretName = config.source_secret as string;
    if (apiKeySecretName) {
      api_key = Deno.env.get(apiKeySecretName) || '';
    }
    if (sourceSecretName) {
      source = Deno.env.get(sourceSecretName) || '';
    }
    console.log('Resolved secrets from env:', { apiKeySecretName, sourceSecretName, hasApiKey: !!api_key, hasSource: !!source });
  } else {
    api_key = (config.api_key as string) || '';
    source = (config.source as string) || '';
  }

  return { api_key, source };
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

    // === STEP 1: Check for closer-specific notification config ===
    let apiKey = '';
    let apiSource = '';
    let templateMap: Record<string, { name: string; isVideo: boolean }> = { ...DEFAULT_TEMPLATE_MAP };
    let videoUrl = DEFAULT_VIDEO_URL;
    let supportNumber = '+919266395637';
    let includeZoomLinkTypes: string[] = ['ten_minutes', 'we_are_live'];

    const { data: closerNotifConfig } = await supabase
      .from('closer_notification_configs')
      .select('*, aisensy_integration:organization_integrations!closer_notification_configs_aisensy_integration_id_fkey(config)')
      .eq('closer_id', appointment.closer_id)
      .eq('organization_id', appointment.organization_id)
      .eq('is_active', true)
      .maybeSingle();

    if (closerNotifConfig) {
      console.log('Found closer notification config for closer:', closer?.full_name);

      // Resolve AISensy credentials from the linked integration
      if (closerNotifConfig.aisensy_integration) {
        const integrationConfig = (closerNotifConfig.aisensy_integration as any).config as Record<string, unknown>;
        const resolved = resolveConfig(integrationConfig);
        apiKey = resolved.api_key;
        apiSource = resolved.source;
      }

      // Use closer's templates
      if (closerNotifConfig.templates && typeof closerNotifConfig.templates === 'object') {
        const closerTemplates = closerNotifConfig.templates as Record<string, string>;
        for (const [key, value] of Object.entries(closerTemplates)) {
          if (value) {
            // Check if call_booked type - those are video templates
            templateMap[key] = { name: value, isVideo: key === 'call_booked' };
          }
        }
      }

      if (closerNotifConfig.video_url) videoUrl = closerNotifConfig.video_url;
      if (closerNotifConfig.support_number) supportNumber = closerNotifConfig.support_number;
      if (closerNotifConfig.include_zoom_link_types) {
        includeZoomLinkTypes = closerNotifConfig.include_zoom_link_types;
      }
    }

    // === STEP 2: Fallback to org-level WhatsApp/AISensy integration ===
    if (!apiKey) {
      // Try aisensy integrations first, then whatsapp
      const { data: aisensyIntegration } = await supabase
        .from('organization_integrations')
        .select('config')
        .eq('organization_id', appointment.organization_id)
        .like('integration_type', 'aisensy%')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (aisensyIntegration?.config) {
        const resolved = resolveConfig(aisensyIntegration.config as Record<string, unknown>);
        apiKey = resolved.api_key;
        apiSource = resolved.source;
      }
    }

    if (!apiKey) {
      const { data: whatsappIntegration } = await supabase
        .from('organization_integrations')
        .select('config')
        .eq('organization_id', appointment.organization_id)
        .eq('integration_type', 'whatsapp')
        .eq('is_active', true)
        .maybeSingle();

      if (whatsappIntegration?.config) {
        const config = whatsappIntegration.config as Record<string, unknown>;
        const resolved = resolveConfig(config);
        apiKey = resolved.api_key;
        apiSource = resolved.source;

        // Also pick up templates/video/support from legacy whatsapp config
        if (config.templates) {
          const legacyTemplates = config.templates as Record<string, unknown>;
          for (const [key, value] of Object.entries(legacyTemplates)) {
            if (typeof value === 'string') {
              templateMap[key] = { name: value, isVideo: key === 'call_booked' };
            } else if (value && typeof value === 'object') {
              const tmpl = value as { name: string; isVideo?: boolean };
              templateMap[key] = { name: tmpl.name, isVideo: tmpl.isVideo || false };
            }
          }
        }
        if (config.video_url) videoUrl = config.video_url as string;
        if (config.support_number) supportNumber = config.support_number as string;
      }
    }

    // === STEP 3: Final fallback to env variables ===
    if (!apiKey) {
      apiKey = Deno.env.get('AISENSY_API_KEY') || '';
      apiSource = Deno.env.get('AISENSY_SOURCE') || '';
    }

    if (!apiKey || !apiSource) {
      console.log('No AISensy/WhatsApp integration configured, skipping reminder');
      await supabase
        .from('call_reminders')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', reminder_id);

      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'No WhatsApp integration configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get template for this reminder type
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

    // Build template params based on reminder type
    // Determine if zoom link should be included
    const shouldIncludeZoomLink = includeZoomLinkTypes.includes(reminder.reminder_type);
    const zoomLink = shouldIncludeZoomLink ? (appointment.zoom_link || 'Link will be shared shortly') : 'Link will be shared shortly';

    let templateParams: string[] = [];
    
    switch (reminder.reminder_type) {
      case 'call_booked':
        templateParams = [
          lead.contact_name,
          'Our Crypto Expert',
          formattedDate,
          formattedTime,
          shouldIncludeZoomLink && appointment.zoom_link ? appointment.zoom_link : 'you will get zoom link 30 minutes before the zoom call',
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
          zoomLink,
        ];
        break;
      case 'we_are_live':
        templateParams = [
          lead.contact_name,
          'One-to-one call with our crypto expert',
          zoomLink,
        ];
        break;
    }

    console.log('Sending WhatsApp:', {
      closer: closer?.full_name,
      template: template.name,
      phone: phoneWithCountry,
      params: templateParams,
      hasApiKey: !!apiKey,
    });

    // Build WhatsApp payload
    const whatsappPayload: any = {
      apiKey: apiKey,
      campaignName: template.name,
      destination: phoneWithCountry,
      userName: 'Crypto Call',
      source: apiSource,
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
