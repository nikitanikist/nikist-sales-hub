import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { sessionId, status, phoneNumber, timestamp } = payload;

    console.log('WhatsApp status webhook received:', JSON.stringify({ sessionId, status, phoneNumber, timestamp }));

    if (!sessionId || !status) {
      console.error('Missing required fields: sessionId and status');
      return new Response(
        JSON.stringify({ error: 'sessionId and status are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Find the session by vps_session_id stored inside session_data JSONB
    const { data: session, error: findError } = await supabase
      .from('whatsapp_sessions')
      .select('id, organization_id, phone_number, status, session_data')
      .filter('session_data->>vps_session_id', 'eq', sessionId)
      .maybeSingle();

    if (findError) {
      console.error('Error finding session:', findError);
      return new Response(
        JSON.stringify({ error: 'Database lookup failed', details: findError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!session) {
      console.warn('No session found for vps_session_id:', sessionId);
      return new Response(
        JSON.stringify({ error: 'Session not found', sessionId }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found session:', { dbId: session.id, orgId: session.organization_id, currentStatus: session.status });

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      status: status,
      last_active_at: timestamp || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (phoneNumber) {
      updatePayload.phone_number = phoneNumber;
    }

    if (status === 'connected') {
      updatePayload.connected_at = timestamp || new Date().toISOString();
      updatePayload.last_error = null;
      updatePayload.last_error_at = null;
    }

    // If connecting with a phone number, clear it from old sessions first
    // to avoid unique constraint violation
    if (status === 'connected' && phoneNumber && session.organization_id) {
      const { error: clearError } = await supabase
        .from('whatsapp_sessions')
        .update({ phone_number: null })
        .eq('organization_id', session.organization_id)
        .eq('phone_number', phoneNumber)
        .neq('id', session.id);
      if (clearError) {
        console.error('Failed to clear old phone numbers:', clearError);
      } else {
        console.log(`Cleared phone number ${phoneNumber} from old sessions in org ${session.organization_id}`);
      }
    }

    // Update the session
    const { error: updateError } = await supabase
      .from('whatsapp_sessions')
      .update(updatePayload)
      .eq('id', session.id);

    if (updateError) {
      console.error('Error updating session:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update session', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Session updated successfully:', { dbId: session.id, newStatus: status });

    // Auto-migration: if connected and phone number present, migrate old disconnected sessions
    let migrationResults: Record<string, unknown> = {};

    if (status === 'connected' && phoneNumber && session.organization_id) {
      console.log('Checking for old disconnected sessions to migrate for phone:', phoneNumber);

      // Find old disconnected sessions with same phone number in same org
      const { data: oldSessions, error: oldError } = await supabase
        .from('whatsapp_sessions')
        .select('id')
        .eq('organization_id', session.organization_id)
        .eq('phone_number', phoneNumber)
        .eq('status', 'disconnected')
        .neq('id', session.id);

      if (oldError) {
        console.error('Error finding old sessions:', oldError);
      } else if (oldSessions && oldSessions.length > 0) {
        console.log(`Found ${oldSessions.length} old disconnected session(s) to migrate`);

        for (const oldSession of oldSessions) {
          console.log(`Migrating session ${oldSession.id} -> ${session.id}`);

          const { data: migrationResult, error: migrationError } = await supabase
            .rpc('migrate_whatsapp_session', {
              p_old_session_id: oldSession.id,
              p_new_session_id: session.id,
            });

          if (migrationError) {
            console.error(`Migration failed for session ${oldSession.id}:`, migrationError);
            migrationResults[oldSession.id] = { error: migrationError.message };
          } else {
            console.log(`Migration result for ${oldSession.id}:`, JSON.stringify(migrationResult));
            migrationResults[oldSession.id] = migrationResult;

            // Mark old session as migrated
            await supabase
              .from('whatsapp_sessions')
              .update({ status: 'migrated', updated_at: new Date().toISOString() })
              .eq('id', oldSession.id);
          }
        }
      } else {
        console.log('No old disconnected sessions found to migrate');
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sessionId: session.id,
        status,
        migration: migrationResults,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Webhook error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
