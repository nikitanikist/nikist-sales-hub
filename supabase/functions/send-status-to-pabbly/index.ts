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
    const pabblyWebhookUrl = Deno.env.get('PABBLY_STATUS_WEBHOOK_URL');
    if (!pabblyWebhookUrl) {
      throw new Error('PABBLY_STATUS_WEBHOOK_URL not configured');
    }

    const body = await req.json();
    console.log('Sending to Pabbly:', JSON.stringify(body, null, 2));

    // Send to Pabbly webhook
    const response = await fetch(pabblyWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
