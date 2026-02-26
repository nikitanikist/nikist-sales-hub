import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";
import { fetchWithRetry } from "../_shared/fetchWithRetry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const VPS_URL = Deno.env.get('WHATSAPP_VPS_URL')!;
    const VPS_API_KEY = Deno.env.get('WHATSAPP_VPS_API_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { campaign_id, manual_confirm } = await req.json();

    if (!campaign_id) {
      return new Response(
        JSON.stringify({ error: 'campaign_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('notification_campaigns')
      .select('id, status, session_id')
      .eq('id', campaign_id)
      .single();

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch failed groups for this campaign
    const { data: failedGroups, error: groupsError } = await supabase
      .from('notification_campaign_groups')
      .select('id, group_name, group_jid, status')
      .eq('campaign_id', campaign_id)
      .eq('status', 'failed');

    if (groupsError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch groups' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!failedGroups || failedGroups.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No failed groups to verify', updated: 0, verified: 0, still_failed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Verifying ${failedGroups.length} failed groups for campaign ${campaign_id}, manual_confirm=${!!manual_confirm}`);

    let updatedCount = 0;
    let stillFailed = 0;

    if (manual_confirm) {
      // Tier 2: Manual confirmation — mark all failed groups as sent (no messageId)
      const groupIds = failedGroups.map(g => g.id);
      
      const { error: updateError } = await supabase
        .from('notification_campaign_groups')
        .update({ 
          status: 'sent' as any, 
          error_message: null,
          sent_at: new Date().toISOString(),
        })
        .in('id', groupIds);

      if (updateError) {
        console.error('Error updating groups:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update group statuses' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      updatedCount = groupIds.length;
      stillFailed = 0;
      console.log(`Manually confirmed ${updatedCount} groups as sent`);
    } else {
      // Tier 1: VPS Verification — query each group's delivery status
      const sessionId = campaign.session_id;

      if (!sessionId) {
        return new Response(
          JSON.stringify({ error: 'Campaign has no session_id, cannot verify via VPS' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      for (const group of failedGroups) {
        try {
          const response = await fetchWithRetry(
            `${VPS_URL}/message-status`,
            {
              method: 'POST',
              headers: {
                'X-API-Key': VPS_API_KEY,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                sessionId,
                groupJid: group.group_jid,
              }),
            },
            { maxRetries: 1, timeoutMs: 10000 }
          );

          const result = await response.json();

          if (result.found && result.messageId) {
            // VPS confirmed delivery — update with recovered messageId
            const { error: updateError } = await supabase
              .from('notification_campaign_groups')
              .update({
                status: 'sent' as any,
                message_id: result.messageId,
                error_message: null,
                sent_at: result.timestamp ? new Date(result.timestamp).toISOString() : new Date().toISOString(),
              })
              .eq('id', group.id);

            if (updateError) {
              console.error(`Error updating group ${group.id}:`, updateError);
              stillFailed++;
            } else {
              updatedCount++;
              console.log(`✓ Group ${group.group_name} verified — messageId: ${result.messageId}`);
            }
          } else {
            // VPS has no record of this message
            stillFailed++;
            console.log(`✗ Group ${group.group_name} not found on VPS`);
          }
        } catch (err) {
          console.error(`Error verifying group ${group.group_name}:`, err);
          stillFailed++;
        }
      }

      console.log(`VPS verification complete: ${updatedCount} verified, ${stillFailed} still failed`);
    }

    // Recalculate campaign counts from actual group statuses
    const { data: allGroups, error: allGroupsError } = await supabase
      .from('notification_campaign_groups')
      .select('status')
      .eq('campaign_id', campaign_id);

    if (!allGroupsError && allGroups) {
      const sentCount = allGroups.filter(g => g.status === 'sent').length;
      const failedCount = allGroups.filter(g => g.status === 'failed').length;
      const pendingCount = allGroups.filter(g => g.status === 'pending').length;

      // Determine new campaign status
      let newStatus = campaign.status;
      if (pendingCount === 0) {
        if (failedCount === 0) {
          newStatus = 'completed';
        } else if (sentCount === 0) {
          newStatus = 'failed';
        } else {
          newStatus = 'partial_failure';
        }
      }

      await supabase
        .from('notification_campaigns')
        .update({
          sent_count: sentCount,
          failed_count: failedCount,
          status: newStatus as any,
        })
        .eq('id', campaign_id);

      console.log(`Campaign ${campaign_id} updated: sent=${sentCount}, failed=${failedCount}, status=${newStatus}`);
    }

    return new Response(
      JSON.stringify({
        message: manual_confirm
          ? `${updatedCount} groups marked as delivered`
          : `${updatedCount} groups verified via VPS, ${stillFailed} still failed`,
        verified: updatedCount,
        still_failed: stillFailed,
        total: failedGroups.length,
        updated: updatedCount, // backward compat
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Verify campaign status error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
