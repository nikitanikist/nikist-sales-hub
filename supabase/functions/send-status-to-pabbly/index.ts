import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const organizationId = body.organization_id;
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    let pabblyWebhookUrl: string | null = null;
    
    // First, try to get webhook URL from organization_webhooks table
    if (organizationId) {
      const { data: webhook } = await supabase
        .from('organization_webhooks')
        .select('url')
        .eq('organization_id', organizationId)
        .eq('direction', 'outgoing')
        .eq('trigger_event', 'call.status_changed')
        .eq('is_active', true)
        .maybeSingle();
      
      if (webhook?.url) {
        pabblyWebhookUrl = webhook.url;
        console.log('Using organization webhook URL');
      }
    }
    
    // Fallback to environment variables for backwards compatibility
    if (!pabblyWebhookUrl) {
      const useNewWebhook = body.use_new_webhook === true;
      const envUrl = useNewWebhook 
        ? Deno.env.get('PABBLY_STATUS_WEBHOOK_URL_NEW')
        : Deno.env.get('PABBLY_STATUS_WEBHOOK_URL');
      
      if (envUrl) {
        pabblyWebhookUrl = envUrl;
        console.log('Using fallback env webhook:', useNewWebhook ? 'NEW' : 'OLD');
      }
    }
    
    if (!pabblyWebhookUrl) {
      throw new Error('No webhook URL configured');
    }

    console.log('Sending to Pabbly:', JSON.stringify(body, null, 2));

    // Remove internal flags before sending to Pabbly
    const { use_new_webhook, organization_id, ...payloadToSend } = body;

    // Send to Pabbly webhook
    const response = await fetch(pabblyWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadToSend),
    });

    console.log('Pabbly response status:', response.status);
    const responseText = await response.text();
    console.log('Pabbly response:', responseText);

    return new Response(
      JSON.stringify({ success: true, pabblyStatus: response.status }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error sending to Pabbly:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
