import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// VPS auth header strategies to try in order
const AUTH_STRATEGIES = [
  (apiKey: string) => ({ 'X-API-Key': apiKey }),
  (apiKey: string) => ({ 'Authorization': `Bearer ${apiKey}` }),
  (apiKey: string) => ({ 'Authorization': apiKey }),
  (apiKey: string) => ({ 'apikey': apiKey }),
];

// Safe JSON parse that returns the text if parsing fails
function safeJsonParse(text: string): { parsed: any; isJson: boolean } {
  try {
    return { parsed: JSON.parse(text), isJson: true };
  } catch {
    return { parsed: text, isJson: false };
  }
}

// Truncate response body for safe logging/error display
function truncate(str: string, maxLen = 200): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '... [truncated]';
}

// Build full URL safely (handles trailing slashes)
function buildUrl(base: string, path: string): string {
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

// Try fetch with multiple auth header strategies
async function fetchWithAuthRetry(
  url: string,
  method: string,
  body: string | undefined,
  apiKey: string
): Promise<{ response: Response; strategyUsed: number }> {
  let lastResponse: Response | null = null;
  
  for (let i = 0; i < AUTH_STRATEGIES.length; i++) {
    const authHeaders = AUTH_STRATEGIES[i](apiKey);
    
    console.log(`VPS auth attempt ${i + 1}/${AUTH_STRATEGIES.length} using header: ${Object.keys(authHeaders)[0]}`);
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body,
    });
    
    console.log(`VPS response status: ${response.status}`);
    
    // If not 401, return immediately (could be success or other error)
    if (response.status !== 401) {
      return { response, strategyUsed: i };
    }
    
    // Store last 401 response for fallback
    lastResponse = response;
  }
  
  // All strategies returned 401
  console.log('All VPS auth strategies returned 401');
  return { response: lastResponse!, strategyUsed: -1 };
}

interface VPSProxyRequest {
  action: 'connect' | 'status' | 'qr' | 'disconnect' | 'sync-groups' | 'send' | 'health';
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
        JSON.stringify({ 
          error: 'WhatsApp VPS not configured',
          hint: 'Please set WHATSAPP_VPS_URL and WHATSAPP_VPS_API_KEY secrets'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', hint: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    // Validate user token
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Auth validation failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized', hint: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;

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

      case 'health':
        vpsEndpoint = '/health';
        vpsMethod = 'GET';
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action', hint: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Build full URL safely
    const vpsUrl = buildUrl(VPS_URL, vpsEndpoint);
    console.log(`Proxying ${vpsMethod} request to ${vpsUrl}`);

    // Make request to VPS with auth retry
    const { response: vpsResponse, strategyUsed } = await fetchWithAuthRetry(
      vpsUrl,
      vpsMethod,
      vpsBody ? JSON.stringify(vpsBody) : undefined,
      VPS_API_KEY
    );

    // Read response as text first (safe)
    const responseText = await vpsResponse.text();
    const { parsed: responseData, isJson } = safeJsonParse(responseText);

    // Log success or failure
    if (vpsResponse.ok) {
      console.log(`VPS request succeeded with auth strategy ${strategyUsed + 1}`);
    } else {
      console.error(`VPS request failed with status ${vpsResponse.status}:`, truncate(responseText));
    }

    // Handle non-2xx responses with rich error info
    if (!vpsResponse.ok) {
      const errorPayload: Record<string, any> = {
        error: isJson && responseData?.error ? responseData.error : 'VPS request failed',
        upstream: 'vps',
        status: vpsResponse.status,
        responsePreview: truncate(responseText),
      };

      // Add specific hints based on status
      if (vpsResponse.status === 401) {
        errorPayload.hint = 'VPS rejected credentials. The API key may be incorrect or the VPS expects a different authentication format.';
        errorPayload.suggestion = 'Verify WHATSAPP_VPS_API_KEY secret matches what the VPS expects.';
      } else if (vpsResponse.status === 404) {
        errorPayload.hint = 'VPS endpoint not found. The VPS may not support this action or the URL is incorrect.';
      } else if (vpsResponse.status >= 500) {
        errorPayload.hint = 'VPS internal error. The VPS service may be down or experiencing issues.';
      }

      return new Response(
        JSON.stringify(errorPayload),
        { status: vpsResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle session storage for connect action
    if (action === 'connect' && isJson && responseData?.sessionId) {
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
    if (action === 'status' && isJson && sessionId && organizationId) {
      const { error: updateError } = await supabase
        .from('whatsapp_sessions')
        .update({
          status: responseData?.status || 'unknown',
          phone_number: responseData?.phoneNumber || null,
          updated_at: new Date().toISOString(),
        })
        .eq('session_id', sessionId);

      if (updateError) {
        console.error('Failed to update session status:', updateError);
      }
    }

    // Store synced groups
    if (action === 'sync-groups' && isJson && responseData?.groups && organizationId) {
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
      isJson ? JSON.stringify(responseData) : responseText,
      { 
        status: vpsResponse.status, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': isJson ? 'application/json' : 'text/plain' 
        } 
      }
    );

  } catch (error: unknown) {
    console.error('VPS Proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        upstream: 'proxy',
        hint: 'An unexpected error occurred in the proxy function'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
