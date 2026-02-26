import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

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
        JSON.stringify({ message: 'No failed groups to verify', updated: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Verifying ${failedGroups.length} failed groups for campaign ${campaign_id}`);

    let updatedCount = 0;

    if (manual_confirm) {
      // Manual confirmation: mark all failed groups as sent
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
      console.log(`Manually confirmed ${updatedCount} groups as sent`);
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
        message: `${updatedCount} groups marked as delivered`,
        updated: updatedCount,
        total_failed: failedGroups.length,
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
