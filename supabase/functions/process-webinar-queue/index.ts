import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";
import { fetchWithTimeout } from '../_shared/fetchWithRetry.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AUTH_STRATEGIES = [
  (apiKey: string) => ({ 'X-API-Key': apiKey }),
  (apiKey: string) => ({ 'Authorization': `Bearer ${apiKey}` }),
  (apiKey: string) => ({ 'Authorization': apiKey }),
  (apiKey: string) => ({ 'apikey': apiKey }),
];

function safeJsonParse(text: string): { parsed: any; isJson: boolean } {
  try {
    return { parsed: JSON.parse(text), isJson: true };
  } catch {
    return { parsed: text, isJson: false };
  }
}

function buildUrl(base: string, path: string): string {
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

async function fetchWithAuthRetry(
  url: string, method: string, body: string | undefined, apiKey: string
): Promise<{ response: Response; strategyUsed: number }> {
  let lastResponse: Response | null = null;
  for (let i = 0; i < AUTH_STRATEGIES.length; i++) {
    const authHeaders = AUTH_STRATEGIES[i](apiKey);
    const response = await fetchWithTimeout(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body,
    }, 10000);
    if (response.status !== 401) return { response, strategyUsed: i };
    lastResponse = response;
  }
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
      return new Response(
        JSON.stringify({ error: 'WhatsApp VPS not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date().toISOString();
    const { data: pendingMessages, error: fetchError } = await supabase
      .from('scheduled_webinar_messages')
      .select(`
        *,
        whatsapp_groups!inner(
          group_jid, 
          session_id,
          whatsapp_sessions!inner(session_data)
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

    console.log(`Processing ${pendingMessages.length} pending webinar messages`);

    const results = await Promise.allSettled(
      pendingMessages.map(async (msg) => {
        const group = msg.whatsapp_groups;
        if (!group?.group_jid || !group?.session_id) throw new Error('Missing group configuration');

        const sessionData = group.whatsapp_sessions?.session_data as { vps_session_id?: string } | null;
        const vpsSessionId = sessionData?.vps_session_id || `wa_${group.session_id}`;

        const vpsUrl = buildUrl(VPS_URL, '/send');
        const vpsBody = JSON.stringify({
          sessionId: vpsSessionId,
          phone: group.group_jid,
          message: msg.message_content,
          ...(msg.media_url && { mediaUrl: msg.media_url }),
          ...(msg.media_type && { mediaType: msg.media_type }),
        });

        const { response } = await fetchWithAuthRetry(vpsUrl, 'POST', vpsBody, VPS_API_KEY);
        const responseText = await response.text();
        const { parsed: responseData, isJson } = safeJsonParse(responseText);

        if (!response.ok) {
          const errorMessage = isJson && responseData?.error
            ? responseData.error
            : `VPS error ${response.status}: ${responseText.slice(0, 200)}`;
          throw new Error(errorMessage);
        }

        await supabase
          .from('scheduled_webinar_messages')
          .update({ status: 'sent', sent_at: new Date().toISOString(), error_message: null })
          .eq('id', msg.id);

        return { id: msg.id, status: 'sent' };
      })
    );

    // Handle failures
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const msg = pendingMessages[i];
      if (result.status === 'rejected') {
        const retryCount = (msg.retry_count || 0) + 1;
        const isFinalFailure = retryCount >= 3;
        const errorMessage = result.reason?.message || 'Unknown error';

        await supabase
          .from('scheduled_webinar_messages')
          .update({
            status: isFinalFailure ? 'failed' : 'pending',
            retry_count: retryCount,
            error_message: errorMessage,
          })
          .eq('id', msg.id);

        if (isFinalFailure) {
          const group = msg.whatsapp_groups;
          const sessionData = group?.whatsapp_sessions?.session_data as { vps_session_id?: string } | null;
          const vpsSessionId = sessionData?.vps_session_id || `wa_${group?.session_id}`;

          await supabase.from('dead_letter_queue').insert({
            organization_id: msg.organization_id,
            source_table: 'scheduled_webinar_messages',
            source_id: msg.id,
            payload: {
              group_jid: group?.group_jid,
              session_id: group?.session_id,
              message_content: msg.message_content,
              media_url: msg.media_url,
              media_type: msg.media_type,
              scheduled_for: msg.scheduled_for,
              webinar_id: msg.webinar_id,
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
          });
        }
      }
    }

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failCount = results.filter(r => r.status === 'rejected').length;

    console.log(`Processed: ${successCount} sent, ${failCount} failed`);

    return new Response(
      JSON.stringify({ message: 'Processing complete', processed: pendingMessages.length, sent: successCount, failed: failCount }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Queue processor error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
