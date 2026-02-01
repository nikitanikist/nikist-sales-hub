import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface CreateCommunityRequest {
  workshopId: string;
  workshopName: string;
  organizationId: string;
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
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!VPS_URL || !VPS_API_KEY) {
      console.log('WhatsApp VPS not configured, skipping community creation');
      return new Response(
        JSON.stringify({ 
          success: false, 
          skipped: true,
          reason: 'WhatsApp VPS not configured'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role key for edge function calls (no user auth required)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse request body
    const body: CreateCommunityRequest = await req.json();
    const { workshopId, workshopName, organizationId } = body;

    if (!workshopId || !workshopName) {
      return new Response(
        JSON.stringify({ error: 'workshopId and workshopName are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Creating WhatsApp community for workshop: ${workshopName} (${workshopId})`);

    // Step 1: Get the workshop details including tag_id
    let orgId = organizationId;
    let workshopTagId: string | null = null;
    let workshopStartDate: string | null = null;
    
    const { data: workshop, error: workshopError } = await supabase
      .from('workshops')
      .select('organization_id, tag_id, start_date')
      .eq('id', workshopId)
      .single();

    if (workshopError || !workshop) {
      console.error('Failed to get workshop:', workshopError);
      return new Response(
        JSON.stringify({ error: 'Workshop not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    orgId = workshop.organization_id;
    workshopTagId = workshop.tag_id;
    workshopStartDate = workshop.start_date;

    // Get community session ID from organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('community_session_id')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      console.error('Failed to get organization:', orgError);
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!org.community_session_id) {
      console.log('No community session configured for organization, skipping community creation');
      return new Response(
        JSON.stringify({ 
          success: false, 
          skipped: true,
          reason: 'No community session configured'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Get the VPS session ID from the whatsapp_sessions table
    const { data: session, error: sessionError } = await supabase
      .from('whatsapp_sessions')
      .select('session_data, status')
      .eq('id', org.community_session_id)
      .single();

    if (sessionError || !session) {
      console.error('Failed to get WhatsApp session:', sessionError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          skipped: true,
          reason: 'WhatsApp session not found'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (session.status !== 'connected') {
      console.log('WhatsApp session not connected, skipping community creation');
      return new Response(
        JSON.stringify({ 
          success: false, 
          skipped: true,
          reason: 'WhatsApp session not connected'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sessionData = session.session_data as { vps_session_id?: string } | null;
    const vpsSessionId = sessionData?.vps_session_id;

    if (!vpsSessionId) {
      console.error('No VPS session ID found in session data');
      return new Response(
        JSON.stringify({ 
          success: false, 
          skipped: true,
          reason: 'Invalid session configuration'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Look up community template for this workshop's tag
    let communityDescription = `Community for ${workshopName}`;
    let profilePictureUrl: string | null = null;
    
    if (workshopTagId) {
      console.log('Fetching community template for tag:', workshopTagId);
      const { data: template, error: templateError } = await supabase
        .from('community_templates')
        .select('*')
        .eq('tag_id', workshopTagId)
        .maybeSingle();
      
      if (templateError) {
        console.error('Error fetching community template:', templateError);
      } else if (template) {
        console.log('Found community template:', template.id);
        
        // Parse template variables
        let parsedDescription = template.description_template;
        
        // Extract workshop_title and workshop_date from workshop name
        let workshopTitle = workshopName;
        let workshopDate = '';
        
        if (workshopName.includes('<>')) {
          const parts = workshopName.split('<>');
          workshopTitle = parts[0].trim();
          workshopDate = parts[1]?.trim() || '';
        }
        
        // Format start time (default 7:00 PM IST)
        let startTime = '7:00 PM IST';
        if (workshopStartDate) {
          try {
            const date = new Date(workshopStartDate);
            const hours = date.getUTCHours() + 5; // Convert to IST (UTC+5:30)
            const adjustedHours = hours % 24;
            const minutes = (date.getUTCMinutes() + 30) % 60;
            const period = adjustedHours >= 12 ? 'PM' : 'AM';
            const displayHours = adjustedHours > 12 ? adjustedHours - 12 : adjustedHours || 12;
            startTime = `${displayHours}:${minutes.toString().padStart(2, '0')} ${period} IST`;
          } catch (e) {
            console.error('Error formatting start time:', e);
          }
        }
        
        // Replace variables
        parsedDescription = parsedDescription
          .replace(/{workshop_name}/g, workshopName)
          .replace(/{workshop_title}/g, workshopTitle)
          .replace(/{workshop_date}/g, workshopDate)
          .replace(/{start_time}/g, startTime);
        
        communityDescription = parsedDescription;
        profilePictureUrl = template.profile_picture_url;
        
        console.log('Parsed community description:', communityDescription);
      }
    }

    // Step 4: Call VPS /create-community endpoint
    console.log(`Calling VPS /create-community with session: ${vpsSessionId}`);
    
    const vpsUrl = VPS_URL.endsWith('/') ? VPS_URL.slice(0, -1) : VPS_URL;
    const vpsPayload: Record<string, unknown> = {
      sessionId: vpsSessionId,
      name: workshopName,
      description: communityDescription,
      settings: {
        announcement: true,  // Only admins can send messages
        restrict: true,      // Only admins can edit settings
      },
    };
    
    // Add profile picture if available (VPS needs to support this)
    if (profilePictureUrl) {
      vpsPayload.profilePictureUrl = profilePictureUrl;
      console.log('Including profile picture URL:', profilePictureUrl);
    }
    
    const vpsResponse = await fetch(`${vpsUrl}/create-community`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': VPS_API_KEY,
      },
      body: JSON.stringify(vpsPayload),
    });

    const vpsResult = await vpsResponse.json();
    console.log('VPS response:', JSON.stringify(vpsResult, null, 2));

    if (!vpsResponse.ok || !vpsResult.success) {
      console.error('VPS create-community failed:', vpsResult);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: vpsResult.error || 'Failed to create community on VPS',
          vpsStatus: vpsResponse.status,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Insert the new group into whatsapp_groups table
    const { data: newGroup, error: groupInsertError } = await supabase
      .from('whatsapp_groups')
      .insert({
        organization_id: orgId,
        session_id: org.community_session_id,
        group_jid: vpsResult.groupId,
        group_name: workshopName,
        is_active: true,
        is_admin: true,
        participant_count: 1, // Just the admin initially
        invite_link: vpsResult.inviteLink || null,
      })
      .select('id')
      .single();

    if (groupInsertError) {
      console.error('Failed to insert group into database:', groupInsertError);
      // Don't fail completely - the community was created on VPS
      return new Response(
        JSON.stringify({ 
          success: true, 
          warning: 'Community created but failed to save to database',
          groupId: vpsResult.groupId,
          inviteLink: vpsResult.inviteLink,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Group saved to database:', newGroup.id);

    // Step 5: Link the group to the workshop via workshop_whatsapp_groups junction table
    const { error: junctionError } = await supabase
      .from('workshop_whatsapp_groups')
      .insert({
        workshop_id: workshopId,
        group_id: newGroup.id,
      });

    if (junctionError) {
      console.error('Failed to link group to workshop:', junctionError);
    } else {
      console.log('Group linked to workshop successfully');
    }

    // Step 6: Update workshop.community_group_id
    const { error: workshopUpdateError } = await supabase
      .from('workshops')
      .update({ community_group_id: newGroup.id })
      .eq('id', workshopId);

    if (workshopUpdateError) {
      console.error('Failed to update workshop community_group_id:', workshopUpdateError);
    } else {
      console.log('Workshop community_group_id updated');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        groupId: newGroup.id,
        groupJid: vpsResult.groupId,
        groupName: workshopName,
        inviteLink: vpsResult.inviteLink,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
