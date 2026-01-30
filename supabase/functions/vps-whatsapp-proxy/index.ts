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

// Lookup VPS session ID from local DB session UUID
async function getVpsSessionId(
  supabaseClient: any,
  localSessionId: string
): Promise<string | null> {
  const { data, error } = await supabaseClient
    .from('whatsapp_sessions')
    .select('session_data')
    .eq('id', localSessionId)
    .single();

  if (error || !data) {
    console.error('Failed to lookup VPS session ID:', error);
    return null;
  }

  // session_data is JSONB with { vps_session_id: "..." }
  const sessionData = (data as any)?.session_data as { vps_session_id?: string } | null;
  return sessionData?.vps_session_id || null;
}

interface VPSProxyRequest {
  action: 'connect' | 'status' | 'disconnect' | 'send' | 'health' | 'sync-groups';
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
          hint: 'Please set WHATSAPP_VPS_URL and WHATSAPP_VPS_API_KEY secrets in your backend'
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
    let localSessionIdForDb: string | null = null;
    let vpsSessionIdForVps: string | null = null;

    switch (action) {
      case 'connect': {
        // Generate local session UUID and VPS-friendly session ID
        localSessionIdForDb = crypto.randomUUID();
        vpsSessionIdForVps = `wa_${localSessionIdForDb}`;
        
        vpsEndpoint = '/connect';
        vpsMethod = 'POST';
        vpsBody = { sessionId: vpsSessionIdForVps };
        break;
      }

      case 'status':
      case 'disconnect': {
        if (!sessionId) {
          return new Response(
            JSON.stringify({ error: 'Session ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        localSessionIdForDb = sessionId;
        
        // Lookup VPS session ID from database
        vpsSessionIdForVps = await getVpsSessionId(supabase, sessionId);
        
        if (!vpsSessionIdForVps) {
          // Fallback: maybe it's a legacy session where session_data wasn't populated
          // Try using the sessionId directly as the VPS session ID
          console.warn('No VPS session ID found in DB, using sessionId directly as fallback');
          vpsSessionIdForVps = sessionId;
        }
        
        if (action === 'status') {
          // VPS /status endpoint returns both status AND qrCode
          vpsEndpoint = `/status/${vpsSessionIdForVps}`;
          vpsMethod = 'GET';
        } else if (action === 'disconnect') {
          vpsEndpoint = `/disconnect/${vpsSessionIdForVps}`;
          vpsMethod = 'POST';
        }
        break;
      }

      case 'send': {
        if (!sessionId || !groupId || !message) {
          return new Response(
            JSON.stringify({ error: 'Session ID, group ID, and message are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        localSessionIdForDb = sessionId;
        vpsSessionIdForVps = await getVpsSessionId(supabase, sessionId);
        
        if (!vpsSessionIdForVps) {
          console.warn('No VPS session ID found in DB, using sessionId directly as fallback');
          vpsSessionIdForVps = sessionId;
        }
        
        vpsEndpoint = '/send';
        vpsMethod = 'POST';
        vpsBody = {
          sessionId: vpsSessionIdForVps,
          groupId,
          message,
          ...(mediaUrl && { mediaUrl }),
          ...(mediaType && { mediaType }),
        };
        break;
      }

      case 'health':
        vpsEndpoint = '/health';
        vpsMethod = 'GET';
        break;

      case 'sync-groups': {
        if (!sessionId || !organizationId) {
          return new Response(
            JSON.stringify({ error: 'Session ID and Organization ID are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        localSessionIdForDb = sessionId;
        vpsSessionIdForVps = await getVpsSessionId(supabase, sessionId);
        
        if (!vpsSessionIdForVps) {
          console.warn('No VPS session ID found in DB, using sessionId directly as fallback');
          vpsSessionIdForVps = sessionId;
        }
        
        // Call VPS to get groups
        vpsEndpoint = `/groups/${vpsSessionIdForVps}`;
        vpsMethod = 'GET';
        break;
      }

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
        errorPayload.suggestion = 'Verify WHATSAPP_VPS_API_KEY secret matches what the VPS expects (no quotes, no extra spaces).';
        // Include debug info (safe, non-secret)
        errorPayload.debug = {
          vpsUrlConfigured: !!VPS_URL,
          apiKeyLength: VPS_API_KEY?.length || 0,
          endpoint: vpsEndpoint,
        };
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
    if (action === 'connect' && localSessionIdForDb && vpsSessionIdForVps) {
      const { error: insertError } = await supabase
        .from('whatsapp_sessions')
        .insert({
          id: localSessionIdForDb,
          organization_id: organizationId,
          status: 'connecting',
          session_data: { vps_session_id: vpsSessionIdForVps },
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('Failed to store session:', insertError);
      } else {
        console.log(`Session stored: local=${localSessionIdForDb}, vps=${vpsSessionIdForVps}`);
      }
      
      // Return the LOCAL session ID to the frontend (not VPS session ID)
      return new Response(
        JSON.stringify({ 
          sessionId: localSessionIdForDb,
          status: 'connecting',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update session status for status check (including QR code from VPS response)
    if (action === 'status' && isJson && localSessionIdForDb && organizationId) {
      // Log the full VPS response for debugging
      console.log('VPS status response:', JSON.stringify(responseData, null, 2));
      
      // Map VPS status values to database-compatible status values
      // VPS returns "qr" but database expects "qr_pending"
      const statusMap: Record<string, string> = {
        'qr': 'qr_pending',
        'connected': 'connected',
        'disconnected': 'disconnected',
        'connecting': 'connecting',
      };
      
      // VPS returns { status: "...", qr?: "...", phoneNumber?: "..." }
      // Some VPS implementations use "qrCode" instead of "qr"
      const vpsStatus = responseData?.status || 'unknown';
      const dbStatus = statusMap[vpsStatus] || vpsStatus;
      
      // Try multiple possible field names for QR code
      const qrCodeValue = responseData?.qr || responseData?.qrCode || responseData?.qrcode || null;
      
      console.log(`VPS status: ${vpsStatus}, DB status: ${dbStatus}, QR present: ${!!qrCodeValue}, QR type: ${typeof qrCodeValue}`);
      
      const updatePayload: Record<string, unknown> = {
        status: dbStatus,
        phone_number: responseData?.phoneNumber || null,
        last_active_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      // Store QR code if present
      if (qrCodeValue && typeof qrCodeValue === 'string') {
        updatePayload.qr_code = qrCodeValue;
        // Set QR expiry (typically 60 seconds)
        updatePayload.qr_expires_at = new Date(Date.now() + 60000).toISOString();
        console.log(`Storing QR code (length: ${qrCodeValue.length})`);
      }
      
      const { error: updateError } = await supabase
        .from('whatsapp_sessions')
        .update(updatePayload)
        .eq('id', localSessionIdForDb);

      if (updateError) {
        console.error('Failed to update session status:', updateError);
      }
      
      // Return enriched response with QR code (try multiple field names)
      return new Response(
        JSON.stringify({
          ...responseData,
          qr: qrCodeValue, // Ensure qr field is populated for frontend
          sessionId: localSessionIdForDb,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update session status after successful disconnect
    if (action === 'disconnect' && localSessionIdForDb && organizationId) {
      const { error: updateError } = await supabase
        .from('whatsapp_sessions')
        .update({
          status: 'disconnected',
          phone_number: null,
          qr_code: null,
          qr_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', localSessionIdForDb);

      if (updateError) {
        console.error('Failed to update session status after disconnect:', updateError);
      } else {
        console.log(`Session ${localSessionIdForDb} marked as disconnected`);
      }

      // Return success to frontend
      return new Response(
        JSON.stringify({ 
          success: true, 
          status: 'disconnected',
          sessionId: localSessionIdForDb 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store groups for sync-groups action
    if (action === 'sync-groups' && isJson && localSessionIdForDb && organizationId) {
      const vpsGroups = responseData?.groups || responseData || [];
      
      if (Array.isArray(vpsGroups) && vpsGroups.length > 0) {
        // Upsert groups into database
        const groupsToUpsert = vpsGroups.map((g: any) => ({
          organization_id: organizationId,
          session_id: localSessionIdForDb,
          group_jid: g.id || g.jid || g.groupId,
          group_name: g.name || g.subject || 'Unknown Group',
          participant_count: g.participants?.length || g.size || 0,
          is_active: true,
          synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));
        
        const { error: upsertError } = await supabase
          .from('whatsapp_groups')
          .upsert(groupsToUpsert, { 
            onConflict: 'session_id,group_jid',
            ignoreDuplicates: false 
          });
        
        if (upsertError) {
          console.error('Failed to upsert groups:', upsertError);
        } else {
          console.log(`Synced ${groupsToUpsert.length} groups`);
        }
        
        // Return groups count to frontend
        return new Response(
          JSON.stringify({ 
            success: true, 
            groups: groupsToUpsert,
            count: groupsToUpsert.length 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // No groups found
      return new Response(
        JSON.stringify({ success: true, groups: [], count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
