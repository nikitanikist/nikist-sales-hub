import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

        // Send message to VPS
        const response = await fetch(`${VPS_URL}/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': VPS_API_KEY,
          },
          body: JSON.stringify({
            sessionId: group.session_id,
            groupId: group.group_jid,
            message: msg.message_content,
            ...(msg.media_url && { mediaUrl: msg.media_url }),
            ...(msg.media_type && { mediaType: msg.media_type }),
          }),
        });

        const responseData = await response.json();

        if (!response.ok) {
          throw new Error(responseData.error || 'VPS send failed');
        }

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
    const failedResults = results.filter((r) => r.status === 'rejected');
    for (let i = 0; i < failedResults.length; i++) {
      const msg = pendingMessages[i];
      const result = failedResults.find((_, idx) => 
        results[idx].status === 'rejected' && pendingMessages[idx].id === msg.id
      );
      
      if (result && result.status === 'rejected') {
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
