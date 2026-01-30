import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VPS_URL = Deno.env.get('WHATSAPP_VPS_URL');
    const VPS_API_KEY = Deno.env.get('WHATSAPP_VPS_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!VPS_URL || !VPS_API_KEY) {
      console.error('Missing VPS configuration');
      return new Response(
        JSON.stringify({ error: 'WhatsApp VPS not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch pending messages that are due
    const now = new Date().toISOString();
    const { data: pendingMessages, error: fetchError } = await supabase
      .from('scheduled_whatsapp_messages')
      .select(`
        *,
        whatsapp_groups!inner(group_jid, session_id)
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error('Error fetching pending messages:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch pending messages' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending messages', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${pendingMessages.length} pending messages`);

    const results = await Promise.allSettled(
      pendingMessages.map(async (msg) => {
        const group = msg.whatsapp_groups;
        if (!group?.group_jid || !group?.session_id) {
          throw new Error('Missing group configuration');
        }

        // Build full URL safely
        const vpsUrl = buildUrl(VPS_URL, '/send');

        const vpsBody = JSON.stringify({
          sessionId: group.session_id,
          groupId: group.group_jid,
          message: msg.message_content,
          ...(msg.media_url && { mediaUrl: msg.media_url }),
          ...(msg.media_type && { mediaType: msg.media_type }),
        });

        // Send message to VPS with auth retry
        const { response, strategyUsed } = await fetchWithAuthRetry(
          vpsUrl,
          'POST',
          vpsBody,
          VPS_API_KEY
        );

        const responseText = await response.text();
        const { parsed: responseData, isJson } = safeJsonParse(responseText);

        if (!response.ok) {
          const errorMessage = isJson && responseData?.error 
            ? responseData.error 
            : `VPS error ${response.status}: ${responseText.slice(0, 200)}`;
          throw new Error(errorMessage);
        }

        console.log(`Message ${msg.id} sent with auth strategy ${strategyUsed + 1}`);

        // Update message status to sent
        await supabase
          .from('scheduled_whatsapp_messages')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            error_message: null,
          })
          .eq('id', msg.id);

        return { id: msg.id, status: 'sent' };
      })
    );

    // Handle failed messages
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const msg = pendingMessages[i];
      
      if (result.status === 'rejected') {
        const retryCount = (msg.retry_count || 0) + 1;
        const maxRetries = 3;

        await supabase
          .from('scheduled_whatsapp_messages')
          .update({
            status: retryCount >= maxRetries ? 'failed' : 'pending',
            retry_count: retryCount,
            error_message: result.reason?.message || 'Unknown error',
          })
          .eq('id', msg.id);
      }
    }

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const failCount = results.filter((r) => r.status === 'rejected').length;

    console.log(`Processed: ${successCount} sent, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        message: 'Processing complete',
        processed: pendingMessages.length,
        sent: successCount,
        failed: failCount,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Queue processor error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
