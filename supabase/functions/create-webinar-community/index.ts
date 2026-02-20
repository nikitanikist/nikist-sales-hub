import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface CreateCommunityRequest {
  webinarId: string;
  webinarName: string;
  organizationId: string;
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
      console.log('WhatsApp VPS not configured, skipping community creation');
      return new Response(
        JSON.stringify({ success: false, skipped: true, reason: 'WhatsApp VPS not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: CreateCommunityRequest = await req.json();
    const { webinarId, webinarName, organizationId } = body;

    if (!webinarId || !webinarName) {
      return new Response(
        JSON.stringify({ error: 'webinarId and webinarName are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Creating WhatsApp community for webinar: ${webinarName} (${webinarId})`);

    // Get webinar details
    let orgId = organizationId;
    let webinarTagId: string | null = null;
    let webinarStartDate: string | null = null;

    const { data: webinar, error: webinarError } = await supabase
      .from('webinars')
      .select('organization_id, tag_id, start_date')
      .eq('id', webinarId)
      .single();

    if (webinarError || !webinar) {
      console.error('Failed to get webinar:', webinarError);
      return new Response(
        JSON.stringify({ error: 'Webinar not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    orgId = webinar.organization_id;
    webinarTagId = webinar.tag_id;
    webinarStartDate = webinar.start_date;

    // Get org community session
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('community_session_id, community_admin_numbers')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!org.community_session_id) {
      return new Response(
        JSON.stringify({ success: false, skipped: true, reason: 'No community session configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const communityAdminNumbers = (org.community_admin_numbers as string[]) || [];

    // Get VPS session
    const { data: session, error: sessionError } = await supabase
      .from('whatsapp_sessions')
      .select('session_data, status')
      .eq('id', org.community_session_id)
      .single();

    if (sessionError || !session || session.status !== 'connected') {
      return new Response(
        JSON.stringify({ success: false, skipped: true, reason: 'WhatsApp session not connected' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sessionData = session.session_data as { vps_session_id?: string } | null;
    const vpsSessionId = sessionData?.vps_session_id;
    if (!vpsSessionId) {
      return new Response(
        JSON.stringify({ success: false, skipped: true, reason: 'Invalid session configuration' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Look up community template for this tag
    let communityDescription = `Community for ${webinarName}`;
    let profilePictureUrl: string | null = null;

    if (webinarTagId) {
      const { data: template } = await supabase
        .from('community_templates')
        .select('*')
        .eq('tag_id', webinarTagId)
        .maybeSingle();

      if (template) {
        let parsedDescription = template.description_template;
        let workshopTitle = webinarName;
        let workshopDate = '';

        if (webinarName.includes('<>')) {
          const parts = webinarName.split('<>');
          workshopTitle = parts[0].trim();
          workshopDate = parts[1]?.trim() || '';
        }

        let startTime = '7:00 PM IST';
        if (webinarStartDate) {
          try {
            const date = new Date(webinarStartDate);
            const hours = date.getUTCHours() + 5;
            const adjustedHours = hours % 24;
            const minutes = (date.getUTCMinutes() + 30) % 60;
            const period = adjustedHours >= 12 ? 'PM' : 'AM';
            const displayHours = adjustedHours > 12 ? adjustedHours - 12 : adjustedHours || 12;
            startTime = `${displayHours}:${minutes.toString().padStart(2, '0')} ${period} IST`;
          } catch (e) {
            console.error('Error formatting start time:', e);
          }
        }

        parsedDescription = parsedDescription
          .replace(/{workshop_name}/g, webinarName)
          .replace(/{webinar_name}/g, webinarName)
          .replace(/{workshop_title}/g, workshopTitle)
          .replace(/{workshop_date}/g, workshopDate)
          .replace(/{start_time}/g, startTime);

        communityDescription = parsedDescription;
        profilePictureUrl = template.profile_picture_url;
      }
    }

    // Call VPS to create community
    const vpsUrl = VPS_URL.endsWith('/') ? VPS_URL.slice(0, -1) : VPS_URL;
    const vpsPayload: Record<string, unknown> = {
      sessionId: vpsSessionId,
      name: webinarName,
      description: communityDescription,
      adminNumbers: communityAdminNumbers,
    };

    if (profilePictureUrl) vpsPayload.profilePictureUrl = profilePictureUrl;

    const vpsResponse = await fetch(`${vpsUrl}/create-community`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': VPS_API_KEY },
      body: JSON.stringify(vpsPayload),
    });

    const vpsResult = await vpsResponse.json();
    console.log('VPS response:', JSON.stringify(vpsResult, null, 2));

    if (!vpsResponse.ok || !vpsResult.success) {
      return new Response(
        JSON.stringify({ success: false, error: vpsResult.error || 'Failed to create community on VPS' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store using announcement group JID
    const trackingGroupJid = vpsResult.announcementGroupId || vpsResult.groupId;

    const { data: newGroup, error: groupInsertError } = await supabase
      .from('whatsapp_groups')
      .insert({
        organization_id: orgId,
        session_id: org.community_session_id,
        group_jid: trackingGroupJid,
        group_name: webinarName,
        is_active: true,
        is_admin: true,
        participant_count: 1,
        invite_link: vpsResult.inviteLink || null,
      })
      .select('id')
      .single();

    if (groupInsertError) {
      return new Response(
        JSON.stringify({ success: true, warning: 'Community created but failed to save to database' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Link to webinar via junction table
    await supabase
      .from('webinar_whatsapp_groups')
      .insert({ webinar_id: webinarId, group_id: newGroup.id });

    // Update webinar community_group_id
    await supabase
      .from('webinars')
      .update({ community_group_id: newGroup.id })
      .eq('id', webinarId);

    return new Response(
      JSON.stringify({
        success: true,
        groupId: newGroup.id,
        groupJid: trackingGroupJid,
        groupName: webinarName,
        inviteLink: vpsResult.inviteLink,
        adminInvitesSent: vpsResult.adminInvitesSent || false,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
