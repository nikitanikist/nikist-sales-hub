import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    
    // Determine which webhook URL to use based on the flag
    const useNewWebhook = body.use_new_webhook === true;
    const pabblyWebhookUrl = useNewWebhook 
      ? Deno.env.get('PABBLY_STATUS_WEBHOOK_URL_NEW')
      : Deno.env.get('PABBLY_STATUS_WEBHOOK_URL');
    
    if (!pabblyWebhookUrl) {
      const webhookType = useNewWebhook ? 'PABBLY_STATUS_WEBHOOK_URL_NEW' : 'PABBLY_STATUS_WEBHOOK_URL';
      throw new Error(`${webhookType} not configured`);
    }

    console.log('Using webhook:', useNewWebhook ? 'NEW' : 'OLD');
    console.log('Sending to Pabbly:', JSON.stringify(body, null, 2));

    // Remove the use_new_webhook flag before sending to Pabbly
    const { use_new_webhook, ...payloadToSend } = body;

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
      JSON.stringify({ success: true, pabblyStatus: response.status, webhookUsed: useNewWebhook ? 'new' : 'old' }),
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
