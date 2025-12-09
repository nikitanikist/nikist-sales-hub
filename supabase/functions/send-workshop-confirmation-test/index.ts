const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Test endpoint to send a confirmation message to a specific number
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const AISENSY_FREE_API_KEY = Deno.env.get('AISENSY_FREE_API_KEY');
    const AISENSY_FREE_SOURCE = Deno.env.get('AISENSY_FREE_SOURCE');

    if (!AISENSY_FREE_API_KEY || !AISENSY_FREE_SOURCE) {
      return new Response(
        JSON.stringify({ error: 'Missing AiSensy FREE configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Test data for nikita@nikist.in
    const testPayload = {
      apiKey: AISENSY_FREE_API_KEY,
      campaignName: 'class_registration_confirmation_copy',
      destination: '917042693494',  // Test phone number
      userName: 'Nikita',
      templateParams: [
        'Nikita',                              // Variable 1: Name
        'Crypto Wealth Masterclass (Sh1)',     // Variable 2: Workshop name
        '11th December',                        // Variable 3: Date
        '7 PM',                                 // Variable 4: Time
        'https://nikist.in/registrartionsuccessful'  // Variable 5: URL
      ],
      source: AISENSY_FREE_SOURCE,
      buttons: []
    };

    console.log('Sending test WhatsApp message:', JSON.stringify(testPayload, null, 2));

    const response = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    const result = await response.text();
    console.log('AiSensy API response:', response.status, result);

    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          error: 'WhatsApp API error', 
          status: response.status,
          details: result 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Test message sent to 917042693494',
        api_response: result
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error sending test message:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
