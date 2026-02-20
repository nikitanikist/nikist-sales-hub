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
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

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

    const orgId = webinar.organization_id;

    // Get org community session
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('community_session_id')
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

    // Look up community template for this tag
    let communityDescription = `Community for ${webinarName}`;
    let profilePictureUrl: string | null = null;

    if (webinar.tag_id) {
      const { data: template } = await supabase
        .from('community_templates')
        .select('*')
        .eq('tag_id', webinar.tag_id)
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
        if (webinar.start_date) {
          try {
            const date = new Date(webinar.start_date);
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

    // Delegate to vps-whatsapp-proxy with create-community-standalone action
    // This ensures announcement + restrict settings are applied, no General group
    // The proxy handles: VPS call, DB insert into whatsapp_groups, participant count fetch
    const proxyUrl = `${SUPABASE_URL}/functions/v1/vps-whatsapp-proxy`;
    
    // We need a valid auth token to call the proxy. Use service role to get an admin context.
    // Since the proxy requires user auth, we'll pass the original auth header if available,
    // otherwise create a service-role client call.
    const authHeader = req.headers.get('Authorization');
    
    const proxyPayload = {
      action: 'create-community-standalone',
      sessionId: org.community_session_id,
      organizationId: orgId,
      name: webinarName,
      description: communityDescription,
      announcement: true,
      restrict: true,
      ...(profilePictureUrl && { profilePictureUrl }),
    };

    console.log('Calling vps-whatsapp-proxy with create-community-standalone:', JSON.stringify(proxyPayload));

    const proxyResponse = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader || `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(proxyPayload),
    });

    const proxyResult = await proxyResponse.json();
    console.log('Proxy response:', JSON.stringify(proxyResult));

    if (!proxyResponse.ok || !proxyResult.success) {
      return new Response(
        JSON.stringify({ success: false, error: proxyResult.error || 'Failed to create community via proxy' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // The proxy already inserted the group into whatsapp_groups
    // Now we need to find the inserted group and link it to the webinar
    const announcementGroupId = proxyResult.announcementGroupId;

    if (!announcementGroupId) {
      return new Response(
        JSON.stringify({ success: true, warning: 'Community created but no announcement group ID returned' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the group record by JID
    const { data: groupRecord, error: groupFindError } = await supabase
      .from('whatsapp_groups')
      .select('id, invite_link, participant_count')
      .eq('group_jid', announcementGroupId)
      .eq('organization_id', orgId)
      .single();

    if (groupFindError || !groupRecord) {
      console.error('Failed to find created group in DB:', groupFindError);
      return new Response(
        JSON.stringify({ success: true, warning: 'Community created but failed to link to webinar' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Link to webinar via junction table
    await supabase
      .from('webinar_whatsapp_groups')
      .insert({ webinar_id: webinarId, group_id: groupRecord.id });

    // Update webinar community_group_id
    await supabase
      .from('webinars')
      .update({ community_group_id: groupRecord.id })
      .eq('id', webinarId);

    return new Response(
      JSON.stringify({
        success: true,
        groupId: groupRecord.id,
        groupJid: announcementGroupId,
        groupName: webinarName,
        inviteLink: proxyResult.inviteLink || groupRecord.invite_link,
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
