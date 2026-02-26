import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";
import { fetchWithTimeout } from '../_shared/fetchWithRetry.ts';

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

// Try fetch with multiple auth header strategies (with timeout)
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
    
    const response = await fetchWithTimeout(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body,
    }, 30000);
    
    console.log(`VPS response status: ${response.status}`);
    
    if (response.status !== 401) {
      return { response, strategyUsed: i };
    }
    
    lastResponse = response;
  }
  
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

    const now = new Date().toISOString();
    const { data: pendingMessages, error: fetchError } = await supabase
      .from('scheduled_whatsapp_messages')
      .select(`
        *,
        whatsapp_groups!inner(group_jid),
        workshops!inner(
          whatsapp_session_id,
          session:whatsapp_sessions!whatsapp_session_id(session_data)
        )
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
        if (!group?.group_jid) {
          throw new Error('Missing group configuration');
        }

        const workshop = msg.workshops;
        const sessionData = workshop?.session?.session_data as { vps_session_id?: string } | null;
        const vpsSessionId = sessionData?.vps_session_id || `wa_${workshop?.whatsapp_session_id}`;

        const vpsUrl = buildUrl(VPS_URL, '/send');

        console.log(`Message ${msg.id} media info:`, {
          hasMediaUrl: !!msg.media_url,
          mediaType: msg.media_type,
          mediaUrlPreview: msg.media_url?.slice(0, 80),
        });

        const vpsBody = JSON.stringify({
          sessionId: vpsSessionId,
          phone: group.group_jid,
          message: msg.message_content,
          ...(msg.media_url && { mediaUrl: msg.media_url }),
          ...(msg.media_type && { mediaType: msg.media_type }),
        });

        console.log(`VPS request body for ${msg.id}:`, vpsBody);

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
        const isFinalFailure = retryCount >= maxRetries;
        const errorMessage = result.reason?.message || 'Unknown error';

        await supabase
          .from('scheduled_whatsapp_messages')
          .update({
            status: isFinalFailure ? 'failed' : 'pending',
            retry_count: retryCount,
            error_message: errorMessage,
            vps_error: errorMessage,
          })
          .eq('id', msg.id);

        // Insert into dead letter queue on final failure
        if (isFinalFailure) {
          const group = msg.whatsapp_groups;
          const workshop = msg.workshops;
          const sessionData = workshop?.session?.session_data as { vps_session_id?: string } | null;
          const vpsSessionId = sessionData?.vps_session_id || `wa_${workshop?.whatsapp_session_id}`;

          await supabase.from('dead_letter_queue').insert({
            organization_id: msg.organization_id,
            source_table: 'scheduled_whatsapp_messages',
            source_id: msg.id,
            payload: {
              group_jid: group?.group_jid,
              session_id: workshop?.whatsapp_session_id,
              message_content: msg.message_content,
              media_url: msg.media_url,
              media_type: msg.media_type,
              scheduled_for: msg.scheduled_for,
              workshop_id: msg.workshop_id,
            },
            retry_payload: {
              type: 'vps',
              url: `${VPS_URL}/send`,
              method: 'POST',
              body: {
                sessionId: vpsSessionId,
                phone: group?.group_jid,
                message: msg.message_content,
                ...(msg.media_url && { mediaUrl: msg.media_url }),
                ...(msg.media_type && { mediaType: msg.media_type }),
              },
            },
            error_message: errorMessage,
            retry_count: retryCount,
          }).then(({ error: dlqError }) => {
            if (dlqError) console.error('DLQ insert error:', dlqError);
          });
        }
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