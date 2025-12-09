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
    const calendlyToken = Deno.env.get('CALENDLY_DIPANSHU_TOKEN');
    
    if (!calendlyToken) {
      throw new Error('CALENDLY_DIPANSHU_TOKEN secret not configured');
    }

    console.log('Fetching Calendly user info...');
    
    // Step 1: Get current user info
    const userResponse = await fetch('https://api.calendly.com/users/me', {
      headers: {
        'Authorization': `Bearer ${calendlyToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('Failed to fetch user info:', errorText);
      throw new Error(`Failed to fetch Calendly user: ${userResponse.status} - ${errorText}`);
    }

    const userData = await userResponse.json();
    const userUri = userData.resource.uri;
    const orgUri = userData.resource.current_organization;

    console.log('User URI:', userUri);
    console.log('Organization URI:', orgUri);

    // Step 2: Create webhook subscription
    const webhookUrl = 'https://swnpxkovxhinxzprxviz.supabase.co/functions/v1/calendly-webhook';
    
    console.log('Creating webhook subscription...');
    
    const webhookResponse = await fetch('https://api.calendly.com/webhook_subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${calendlyToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: webhookUrl,
        events: ['invitee.created'],
        organization: orgUri,
        scope: 'user',
        user: userUri
      })
    });

    const webhookData = await webhookResponse.json();

    if (!webhookResponse.ok) {
      console.error('Failed to create webhook:', JSON.stringify(webhookData));
      
      // Check if webhook already exists
      if (webhookData.message?.includes('already exists') || webhookData.title === 'Already Exists') {
        return new Response(JSON.stringify({
          success: true,
          message: 'Webhook already exists for this user',
          details: webhookData
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      throw new Error(`Failed to create webhook: ${webhookResponse.status} - ${JSON.stringify(webhookData)}`);
    }

    console.log('Webhook created successfully:', JSON.stringify(webhookData));

    return new Response(JSON.stringify({
      success: true,
      message: 'Calendly webhook configured successfully',
      webhook: webhookData.resource
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error setting up Calendly webhook:', error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
