import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VPSProxyRequest {
  action: 'connect' | 'status' | 'qr' | 'disconnect' | 'sync-groups' | 'send';
  sessionId?: string;
  organizationId?: string;
  groupId?: string;
  message?: string;
  mediaUrl?: string;
  mediaType?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VPS_URL = Deno.env.get('WHATSAPP_VPS_URL');
    const VPS_API_KEY = Deno.env.get('WHATSAPP_VPS_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    if (!VPS_URL || !VPS_API_KEY) {
      console.error('Missing VPS configuration');
      return new Response(
        JSON.stringify({ error: 'WhatsApp VPS not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error('Auth validation failed:', claimsError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;

    // Parse request body
    const body: VPSProxyRequest = await req.json();
    const { action, sessionId, organizationId, groupId, message, mediaUrl, mediaType } = body;

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Action is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate organization access
    if (organizationId) {
      const { data: membership, error: membershipError } = await supabase
        .from('organization_members')
        .select('id')
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .single();

      if (membershipError || !membership) {
        return new Response(
          JSON.stringify({ error: 'Not authorized for this organization' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    let vpsEndpoint = '';
    let vpsMethod = 'GET';
    let vpsBody: Record<string, unknown> | null = null;

    switch (action) {
      case 'connect':
        vpsEndpoint = '/connect';
        vpsMethod = 'POST';
        vpsBody = { sessionId: sessionId || `org_${organizationId}_${Date.now()}` };
        break;

      case 'status':
        if (!sessionId) {
          return new Response(
            JSON.stringify({ error: 'Session ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        vpsEndpoint = `/status/${sessionId}`;
        vpsMethod = 'GET';
        break;

      case 'qr':
        if (!sessionId) {
          return new Response(
            JSON.stringify({ error: 'Session ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        vpsEndpoint = `/qr/${sessionId}`;
        vpsMethod = 'GET';
        break;

      case 'disconnect':
        if (!sessionId) {
          return new Response(
            JSON.stringify({ error: 'Session ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        vpsEndpoint = `/disconnect/${sessionId}`;
        vpsMethod = 'POST';
        break;

      case 'sync-groups':
        if (!sessionId) {
          return new Response(
            JSON.stringify({ error: 'Session ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        vpsEndpoint = `/groups/sync/${sessionId}`;
        vpsMethod = 'POST';
        break;

      case 'send':
        if (!sessionId || !groupId || !message) {
          return new Response(
            JSON.stringify({ error: 'Session ID, group ID, and message are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        vpsEndpoint = '/send';
        vpsMethod = 'POST';
        vpsBody = {
          sessionId,
          groupId,
          message,
          ...(mediaUrl && { mediaUrl }),
          ...(mediaType && { mediaType }),
        };
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Make request to VPS
    const vpsUrl = `${VPS_URL}${vpsEndpoint}`;
    console.log(`Proxying ${vpsMethod} request to ${vpsUrl}`);

    const vpsResponse = await fetch(vpsUrl, {
      method: vpsMethod,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': VPS_API_KEY,
      },
      ...(vpsBody && { body: JSON.stringify(vpsBody) }),
    });

    const responseData = await vpsResponse.json();

    // Handle session storage for connect action
    if (action === 'connect' && vpsResponse.ok && responseData.sessionId) {
      // Store session in database
      const { error: insertError } = await supabase
        .from('whatsapp_sessions')
        .upsert({
          session_id: responseData.sessionId,
          organization_id: organizationId,
          status: 'connecting',
          created_by: userId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'session_id' });

      if (insertError) {
        console.error('Failed to store session:', insertError);
      }
    }

    // Update session status for status check
    if (action === 'status' && vpsResponse.ok && sessionId && organizationId) {
      const { error: updateError } = await supabase
        .from('whatsapp_sessions')
        .update({
          status: responseData.status || 'unknown',
          phone_number: responseData.phoneNumber || null,
          updated_at: new Date().toISOString(),
        })
        .eq('session_id', sessionId);

      if (updateError) {
        console.error('Failed to update session status:', updateError);
      }
    }

    // Store synced groups
    if (action === 'sync-groups' && vpsResponse.ok && responseData.groups && organizationId) {
      const groups = responseData.groups.map((g: { id: string; name: string; participantCount?: number }) => ({
        group_jid: g.id,
        group_name: g.name,
        organization_id: organizationId,
        session_id: sessionId,
        participant_count: g.participantCount || 0,
        synced_at: new Date().toISOString(),
      }));

      if (groups.length > 0) {
        const { error: groupsError } = await supabase
          .from('whatsapp_groups')
          .upsert(groups, { onConflict: 'group_jid,organization_id' });

        if (groupsError) {
          console.error('Failed to store groups:', groupsError);
        }
      }
    }

    return new Response(
      JSON.stringify(responseData),
      { 
        status: vpsResponse.status, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: unknown) {
    console.error('VPS Proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
