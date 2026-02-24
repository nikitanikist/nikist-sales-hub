import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

// Truncate response body for safe logging/error display
function truncate(str: string, maxLen = 200): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '... [truncated]';
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

// Lookup VPS session ID from local DB session UUID
async function getVpsSessionId(
  supabaseClient: any,
  localSessionId: string
): Promise<string | null> {
  const { data, error } = await supabaseClient
    .from('whatsapp_sessions')
    .select('session_data')
    .eq('id', localSessionId)
    .single();

  if (error || !data) {
    console.error('Failed to lookup VPS session ID:', error);
    return null;
  }

  // session_data is JSONB with { vps_session_id: "..." }
  const sessionData = (data as any)?.session_data as { vps_session_id?: string } | null;
  return sessionData?.vps_session_id || null;
}

interface VPSProxyRequest {
  action: 'connect' | 'status' | 'disconnect' | 'send' | 'health' | 'sync-groups' | 'create-community' | 'create-community-standalone' | 'get-invite-link' | 'add-participants' | 'promote-participants' | 'get-participants' | 'sync-members';
  sessionId?: string;
  organizationId?: string;
  groupId?: string;
  groupJid?: string;
  message?: string;
  mediaUrl?: string;
  mediaType?: string;
  name?: string;
  description?: string;
  phoneNumbers?: string[];
  announcement?: boolean;
  restrict?: boolean;
  profilePictureUrl?: string;
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
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    if (!VPS_URL || !VPS_API_KEY) {
      console.error('Missing VPS configuration');
      return new Response(
        JSON.stringify({ 
          error: 'WhatsApp VPS not configured',
          hint: 'Please set WHATSAPP_VPS_URL and WHATSAPP_VPS_API_KEY secrets in your backend'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', hint: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    // Validate user token
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Auth validation failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized', hint: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;

    // Parse request body
    const body: VPSProxyRequest = await req.json();
    const { action, sessionId, organizationId, groupId, groupJid, message, mediaUrl, mediaType, name, description, phoneNumbers, announcement, restrict: restrictSetting, profilePictureUrl } = body;

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Action is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate organization access
    if (organizationId) {
      const { data: membership, error: membershipError } = await supabase
        .from('organization_members')
        .select('id')
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .single();

      if (membershipError || !membership) {
        return new Response(
          JSON.stringify({ error: 'Not authorized for this organization' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    let vpsEndpoint = '';
    let vpsMethod = 'GET';
    let vpsBody: Record<string, unknown> | null = null;
    let localSessionIdForDb: string | null = null;
    let vpsSessionIdForVps: string | null = null;

    switch (action) {
      case 'connect': {
        // Generate local session UUID and VPS-friendly session ID
        localSessionIdForDb = crypto.randomUUID();
        vpsSessionIdForVps = `wa_${localSessionIdForDb}`;
        
        vpsEndpoint = '/connect';
        vpsMethod = 'POST';
        vpsBody = { sessionId: vpsSessionIdForVps };
        break;
      }

      case 'status':
      case 'disconnect': {
        if (!sessionId) {
          return new Response(
            JSON.stringify({ error: 'Session ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        localSessionIdForDb = sessionId;
        
        // Lookup VPS session ID from database
        vpsSessionIdForVps = await getVpsSessionId(supabase, sessionId);
        
        if (!vpsSessionIdForVps) {
          // Fallback: maybe it's a legacy session where session_data wasn't populated
          // Try using the sessionId directly as the VPS session ID
          console.warn('No VPS session ID found in DB, using sessionId directly as fallback');
          vpsSessionIdForVps = sessionId;
        }
        
        if (action === 'status') {
          // VPS /status endpoint returns both status AND qrCode
          vpsEndpoint = `/status/${vpsSessionIdForVps}`;
          vpsMethod = 'GET';
        } else if (action === 'disconnect') {
          vpsEndpoint = `/disconnect/${vpsSessionIdForVps}`;
          vpsMethod = 'POST';
        }
        break;
      }

      case 'send': {
        if (!sessionId || !groupId || !message) {
          return new Response(
            JSON.stringify({ error: 'Session ID, group ID, and message are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        localSessionIdForDb = sessionId;
        vpsSessionIdForVps = await getVpsSessionId(supabase, sessionId);
        
        if (!vpsSessionIdForVps) {
          console.warn('No VPS session ID found in DB, using sessionId directly as fallback');
          vpsSessionIdForVps = sessionId;
        }
        
        vpsEndpoint = '/send';
        vpsMethod = 'POST';
        vpsBody = {
          sessionId: vpsSessionIdForVps,
          phone: groupId,  // VPS expects "phone" field for recipient (works for both individual and group chats)
          message,
          ...(mediaUrl && { mediaUrl }),
          ...(mediaType && { mediaType }),
        };
        break;
      }

      case 'health':
        vpsEndpoint = '/health';
        vpsMethod = 'GET';
        break;

      case 'sync-groups': {
        if (!sessionId || !organizationId) {
          return new Response(
            JSON.stringify({ error: 'Session ID and Organization ID are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        localSessionIdForDb = sessionId;
        vpsSessionIdForVps = await getVpsSessionId(supabase, sessionId);
        
        if (!vpsSessionIdForVps) {
          console.warn('No VPS session ID found in DB, using sessionId directly as fallback');
          vpsSessionIdForVps = sessionId;
        }
        
        // Call VPS to get groups - include invite links for storage
        vpsEndpoint = `/groups/${vpsSessionIdForVps}?includeInviteLinks=true`;
        vpsMethod = 'GET';
        break;
      }

      case 'create-community': {
        if (!sessionId || !name) {
          return new Response(
            JSON.stringify({ error: 'Session ID and name are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        localSessionIdForDb = sessionId;
        vpsSessionIdForVps = await getVpsSessionId(supabase, sessionId);
        
        if (!vpsSessionIdForVps) {
          console.warn('No VPS session ID found in DB, using sessionId directly as fallback');
          vpsSessionIdForVps = sessionId;
        }
        
        vpsEndpoint = '/create-community';
        vpsMethod = 'POST';
        vpsBody = {
          sessionId: vpsSessionIdForVps,
          name,
          description: description || 'Workshop community',
          settings: {
            announcement: true,  // Only admins can send messages
            restrict: true,      // Only admins can edit settings
          },
        };
        break;
      }

      case 'get-invite-link': {
        if (!sessionId || !groupJid) {
          return new Response(
            JSON.stringify({ error: 'Session ID and group JID are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        localSessionIdForDb = sessionId;
        vpsSessionIdForVps = await getVpsSessionId(supabase, sessionId);
        
        if (!vpsSessionIdForVps) {
          console.warn('No VPS session ID found in DB, using sessionId directly as fallback');
          vpsSessionIdForVps = sessionId;
        }
        
        // Call VPS: GET /groups/{sessionId}/{groupJid}/invite
        vpsEndpoint = `/groups/${vpsSessionIdForVps}/${encodeURIComponent(groupJid)}/invite`;
        vpsMethod = 'GET';
        break;
      }

      case 'add-participants': {
        if (!sessionId || !groupJid || !phoneNumbers || phoneNumbers.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Session ID, group JID, and phoneNumbers are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        localSessionIdForDb = sessionId;
        vpsSessionIdForVps = await getVpsSessionId(supabase, sessionId);
        
        if (!vpsSessionIdForVps) {
          console.warn('No VPS session ID found in DB, using sessionId directly as fallback');
          vpsSessionIdForVps = sessionId;
        }
        
        // Call VPS: POST /groups/{sessionId}/{groupJid}/participants/add
        vpsEndpoint = `/groups/${vpsSessionIdForVps}/${encodeURIComponent(groupJid)}/participants/add`;
        vpsMethod = 'POST';
        vpsBody = { participants: phoneNumbers };
        break;
      }

      case 'promote-participants': {
        if (!sessionId || !groupJid || !phoneNumbers || phoneNumbers.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Session ID, group JID, and phoneNumbers are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        localSessionIdForDb = sessionId;
        vpsSessionIdForVps = await getVpsSessionId(supabase, sessionId);
        
        if (!vpsSessionIdForVps) {
          console.warn('No VPS session ID found in DB, using sessionId directly as fallback');
          vpsSessionIdForVps = sessionId;
        }
        
        // Call VPS: POST /groups/{sessionId}/{groupJid}/participants/promote
        vpsEndpoint = `/groups/${vpsSessionIdForVps}/${encodeURIComponent(groupJid)}/participants/promote`;
        vpsMethod = 'POST';
        vpsBody = { participants: phoneNumbers };
        break;
      }

      case 'get-participants': {
        if (!sessionId || !groupJid) {
          return new Response(
            JSON.stringify({ error: 'Session ID and group JID are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        localSessionIdForDb = sessionId;
        vpsSessionIdForVps = await getVpsSessionId(supabase, sessionId);
        
        if (!vpsSessionIdForVps) {
          console.warn('No VPS session ID found in DB, using sessionId directly as fallback');
          vpsSessionIdForVps = sessionId;
        }
        
        // Call VPS: GET /groups/{sessionId}/{groupJid}/participants
        vpsEndpoint = `/groups/${vpsSessionIdForVps}/${encodeURIComponent(groupJid)}/participants`;
        vpsMethod = 'GET';
        break;
      }

      case 'sync-members': {
        // Sync members from VPS to database - replaces polling-based approach
        if (!sessionId || !groupJid || !organizationId) {
          return new Response(
            JSON.stringify({ error: 'Session ID, group JID, and organization ID are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        localSessionIdForDb = sessionId;
        vpsSessionIdForVps = await getVpsSessionId(supabase, sessionId);
        
        if (!vpsSessionIdForVps) {
          console.warn('No VPS session ID found in DB, using sessionId directly as fallback');
          vpsSessionIdForVps = sessionId;
        }
        
        // Fetch current participants from VPS
        const participantsUrl = buildUrl(VPS_URL, `/groups/${vpsSessionIdForVps}/${encodeURIComponent(groupJid)}/participants`);
        console.log(`Syncing members from VPS: ${participantsUrl}`);
        
        const { response: participantsResponse } = await fetchWithAuthRetry(
          participantsUrl,
          'GET',
          undefined,
          VPS_API_KEY
        );
        
        const participantsText = await participantsResponse.text();
        const { parsed: participantsData, isJson: participantsIsJson } = safeJsonParse(participantsText);
        
        if (!participantsResponse.ok || !participantsIsJson) {
          console.error('Failed to fetch participants from VPS:', truncate(participantsText));
          return new Response(
            JSON.stringify({ 
              error: 'Failed to fetch participants from VPS',
              upstream: 'vps',
              status: participantsResponse.status,
            }),
            { status: participantsResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const vpsParticipants = participantsData?.participants || [];
        console.log(`VPS returned ${vpsParticipants.length} participants`);
        
        if (!Array.isArray(vpsParticipants)) {
          return new Response(
            JSON.stringify({ 
              error: 'Invalid participants response from VPS',
              upstream: 'vps',
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Normalize phone to last 10 digits for consistent matching
        const normalizePhone = (phone: string | null): string => {
          if (!phone) return '';
          const digits = phone.replace(/\D/g, '');
          return digits.slice(-10);
        };
        
        // Create set of normalized phone numbers from VPS
        const vpsPhoneSet = new Set(
          vpsParticipants.map((p: any) => normalizePhone(p.phone || p.id?.split('@')[0]))
        );
        
        // Get current active members from database
        const { data: existingMembers, error: existingError } = await supabase
          .from('workshop_group_members')
          .select('id, phone_number, status')
          .eq('group_jid', groupJid);
        
        if (existingError) {
          console.error('Failed to fetch existing members:', existingError);
        }
        
        const existingMemberMap = new Map(
          (existingMembers || []).map((m: any) => [m.phone_number, m])
        );
        
        // Prepare upserts for VPS members (mark as active)
        const now = new Date().toISOString();
        const membersToUpsert = vpsParticipants.map((p: any) => {
          const fullPhone = p.phone || p.id?.split('@')[0] || '';
          const normalizedPhone = normalizePhone(fullPhone);
          const existing = existingMemberMap.get(normalizedPhone);
          
          return {
            group_jid: groupJid,
            phone_number: normalizedPhone,
            full_phone: fullPhone,
            status: 'active',
            joined_at: existing?.joined_at || now,
            left_at: null,
            updated_at: now,
            organization_id: organizationId,
          };
        });
        
        // Find members who left (in DB but NOT in VPS)
        const membersToMarkLeft: string[] = [];
        for (const [phoneNumber, member] of existingMemberMap) {
          if (!vpsPhoneSet.has(phoneNumber) && (member as any).status === 'active') {
            membersToMarkLeft.push(phoneNumber);
          }
        }
        
        let syncedCount = 0;
        let markedLeftCount = 0;
        
        // Upsert active members
        if (membersToUpsert.length > 0) {
          const { error: upsertError } = await supabase
            .from('workshop_group_members')
            .upsert(membersToUpsert, { 
              onConflict: 'group_jid,phone_number',
              ignoreDuplicates: false 
            });
          
          if (upsertError) {
            console.error('Failed to upsert members:', upsertError);
          } else {
            syncedCount = membersToUpsert.length;
            console.log(`Synced ${syncedCount} active members to database`);
          }
        }
        
        // Mark left members
        if (membersToMarkLeft.length > 0) {
          const { error: leftError } = await supabase
            .from('workshop_group_members')
            .update({ status: 'left', left_at: now, updated_at: now })
            .eq('group_jid', groupJid)
            .in('phone_number', membersToMarkLeft);
          
          if (leftError) {
            console.error('Failed to mark left members:', leftError);
          } else {
            markedLeftCount = membersToMarkLeft.length;
            console.log(`Marked ${markedLeftCount} members as left`);
          }
        }
        
        return new Response(
          JSON.stringify({ 
            success: true,
            synced: syncedCount,
            marked_left: markedLeftCount,
            total_in_group: vpsParticipants.length,
            group_name: participantsData?.groupName,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create-community-standalone': {
        if (!sessionId || !name || !organizationId) {
          return new Response(
            JSON.stringify({ error: 'Session ID, name, and organization ID are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        localSessionIdForDb = sessionId;
        vpsSessionIdForVps = await getVpsSessionId(supabase, sessionId);
        
        if (!vpsSessionIdForVps) {
          console.warn('No VPS session ID found in DB, using sessionId directly as fallback');
          vpsSessionIdForVps = sessionId;
        }

        // Fetch community admin numbers from organization settings
        let adminNumbers: string[] = [];
        try {
          const { data: orgData } = await supabase
            .from('organizations')
            .select('community_admin_numbers')
            .eq('id', organizationId)
            .single();
          if (orgData?.community_admin_numbers && Array.isArray(orgData.community_admin_numbers)) {
            adminNumbers = orgData.community_admin_numbers.filter((n: string) => n && n.trim());
            console.log(`Found ${adminNumbers.length} community admin numbers for org ${organizationId}`);
          }
        } catch (err) {
          console.warn('Failed to fetch community_admin_numbers, proceeding without:', err);
        }

        // Build VPS request
        const communitySettings = {
          announcement: announcement === true,
          restrict: restrictSetting === true,
        };

        const createUrl = buildUrl(VPS_URL, '/create-community');
        console.log(`Creating standalone community via VPS: ${createUrl}`);

        const { response: createResponse } = await fetchWithAuthRetry(
          createUrl,
          'POST',
          JSON.stringify({
            sessionId: vpsSessionIdForVps,
            name,
            description: description || name,
            settings: communitySettings,
            ...(profilePictureUrl && { profilePictureUrl }),
            ...(adminNumbers.length > 0 && { adminNumbers }),
          }),
          VPS_API_KEY
        );

        const createText = await createResponse.text();
        const { parsed: createData, isJson: createIsJson } = safeJsonParse(createText);

        if (!createResponse.ok || !createIsJson) {
          console.error('VPS create-community failed:', truncate(createText));
          return new Response(
            JSON.stringify({
              error: createIsJson ? (createData?.error || 'VPS create-community failed') : 'VPS returned non-JSON',
              upstream: 'vps',
              status: createResponse.status,
            }),
            { status: createResponse.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('VPS create-community response:', JSON.stringify(createData));

        // Extract IDs from VPS response
        const communityId = createData?.communityId || createData?.community_id;
        const announcementGroupId = createData?.announcementGroupId || createData?.announcement_group_id;
        const inviteLink = createData?.inviteLink || createData?.invite_link || '';

        // Insert the announcement group into whatsapp_groups (this is the sendable group)
        if (announcementGroupId) {
          const { error: insertError } = await supabase
            .from('whatsapp_groups')
            .insert({
              organization_id: organizationId,
              session_id: localSessionIdForDb,
              group_jid: announcementGroupId,
              group_name: name,
              participant_count: 0,
              is_active: true,
              is_admin: true,
              is_community: false,
              is_community_announce: true,
              invite_link: inviteLink || null,
              synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (insertError) {
            console.error('Failed to insert community group into DB:', insertError);
          } else {
            console.log(`Inserted announcement group ${announcementGroupId} into whatsapp_groups`);

            // Fetch participant count from VPS and update
            try {
              const participantsUrl = buildUrl(VPS_URL, `/groups/${vpsSessionIdForVps}/${encodeURIComponent(announcementGroupId)}/participants`);
              console.log(`Fetching participant count from: ${participantsUrl}`);
              const { response: partResp } = await fetchWithAuthRetry(participantsUrl, 'GET', undefined, VPS_API_KEY);
              if (partResp.ok) {
                const partText = await partResp.text();
                const { parsed: partData, isJson: partIsJson } = safeJsonParse(partText);
                const participants = partIsJson ? (partData?.participants || []) : [];
                const count = Math.max(Array.isArray(participants) ? participants.length : 0, 1);
                console.log(`Updating participant_count to ${count} for group ${announcementGroupId}`);
                await supabase
                  .from('whatsapp_groups')
                  .update({ participant_count: count })
                  .eq('group_jid', announcementGroupId)
                  .eq('organization_id', organizationId);
              } else {
                console.warn('Failed to fetch participants after community creation, defaulting to 1');
                await supabase
                  .from('whatsapp_groups')
                  .update({ participant_count: 1 })
                  .eq('group_jid', announcementGroupId)
                  .eq('organization_id', organizationId);
              }
            } catch (partErr) {
              console.error('Error fetching participant count:', partErr);
              // Non-blocking: community was created successfully
            }
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            communityId,
            announcementGroupId,
            inviteLink,
            adminInvitesSent: createData?.adminInvitesSent || false,
            adminNumbersInvited: createData?.adminNumbersInvited || [],
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action', hint: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Build full URL safely
    const vpsUrl = buildUrl(VPS_URL, vpsEndpoint);
    console.log(`Proxying ${vpsMethod} request to ${vpsUrl}`);

    // Make request to VPS with auth retry
    const { response: vpsResponse, strategyUsed } = await fetchWithAuthRetry(
      vpsUrl,
      vpsMethod,
      vpsBody ? JSON.stringify(vpsBody) : undefined,
      VPS_API_KEY
    );

    // Read response as text first (safe)
    const responseText = await vpsResponse.text();
    const { parsed: responseData, isJson } = safeJsonParse(responseText);

    // Log success or failure
    if (vpsResponse.ok) {
      console.log(`VPS request succeeded with auth strategy ${strategyUsed + 1}`);
    } else {
      console.error(`VPS request failed with status ${vpsResponse.status}:`, truncate(responseText));
    }

    // Handle non-2xx responses with rich error info
    if (!vpsResponse.ok) {
      const errorPayload: Record<string, any> = {
        error: isJson && responseData?.error ? responseData.error : 'VPS request failed',
        upstream: 'vps',
        status: vpsResponse.status,
        responsePreview: truncate(responseText),
      };

      // Add specific hints based on status
      if (vpsResponse.status === 401) {
        errorPayload.hint = 'VPS rejected credentials. The API key may be incorrect or the VPS expects a different authentication format.';
        errorPayload.suggestion = 'Verify WHATSAPP_VPS_API_KEY secret matches what the VPS expects (no quotes, no extra spaces).';
        // Include debug info (safe, non-secret)
        errorPayload.debug = {
          vpsUrlConfigured: !!VPS_URL,
          apiKeyLength: VPS_API_KEY?.length || 0,
          endpoint: vpsEndpoint,
        };
      } else if (vpsResponse.status === 404) {
        errorPayload.hint = 'VPS endpoint not found. The VPS may not support this action or the URL is incorrect.';
      } else if (vpsResponse.status >= 500) {
        errorPayload.hint = 'VPS internal error. The VPS service may be down or experiencing issues.';
      }

      return new Response(
        JSON.stringify(errorPayload),
        { status: vpsResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle session storage for connect action
    if (action === 'connect' && localSessionIdForDb && vpsSessionIdForVps) {
      const { error: insertError } = await supabase
        .from('whatsapp_sessions')
        .insert({
          id: localSessionIdForDb,
          organization_id: organizationId,
          status: 'connecting',
          session_data: { vps_session_id: vpsSessionIdForVps },
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('Failed to store session:', insertError);
      } else {
        console.log(`Session stored: local=${localSessionIdForDb}, vps=${vpsSessionIdForVps}`);
      }
      
      // Return the LOCAL session ID to the frontend (not VPS session ID)
      return new Response(
        JSON.stringify({ 
          sessionId: localSessionIdForDb,
          status: 'connecting',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update session status for status check (including QR code from VPS response)
    if (action === 'status' && isJson && localSessionIdForDb && organizationId) {
      // Log the full VPS response for debugging
      console.log('VPS status response:', JSON.stringify(responseData, null, 2));
      
      // Map VPS status values to database-compatible status values
      // VPS returns "qr" but database expects "qr_pending"
      const statusMap: Record<string, string> = {
        'qr': 'qr_pending',
        'connected': 'connected',
        'disconnected': 'disconnected',
        'connecting': 'connecting',
      };
      
      // VPS returns { status: "...", qr?: "...", phoneNumber?: "..." }
      // Some VPS implementations use "qrCode" instead of "qr"
      const vpsStatus = responseData?.status || 'unknown';
      const dbStatus = statusMap[vpsStatus] || vpsStatus;
      
      // Try multiple possible field names for QR code
      const qrCodeValue = responseData?.qr || responseData?.qrCode || responseData?.qrcode || null;
      
      console.log(`VPS status: ${vpsStatus}, DB status: ${dbStatus}, QR present: ${!!qrCodeValue}, QR type: ${typeof qrCodeValue}`);
      
      // If this session is now connected with a phone number,
      // clear that phone number from any OTHER sessions in the same org
      // to avoid the unique constraint violation
      if (dbStatus === 'connected' && responseData?.phoneNumber) {
        const { error: clearError } = await supabase
          .from('whatsapp_sessions')
          .update({ phone_number: null })
          .eq('organization_id', organizationId)
          .eq('phone_number', responseData.phoneNumber)
          .neq('id', localSessionIdForDb);
        if (clearError) {
          console.error('Failed to clear old phone numbers:', clearError);
        } else {
          console.log(`Cleared phone number ${responseData.phoneNumber} from old sessions in org ${organizationId}`);
        }
      }

      const updatePayload: Record<string, unknown> = {
        status: dbStatus,
        phone_number: responseData?.phoneNumber || null,
        last_active_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      // Store QR code if present
      if (qrCodeValue && typeof qrCodeValue === 'string') {
        updatePayload.qr_code = qrCodeValue;
        // Set QR expiry (typically 60 seconds)
        updatePayload.qr_expires_at = new Date(Date.now() + 60000).toISOString();
        console.log(`Storing QR code (length: ${qrCodeValue.length})`);
      }

      // Set connected_at when transitioning to connected
      if (dbStatus === 'connected') {
        updatePayload.connected_at = new Date().toISOString();
        updatePayload.last_error = null;
        updatePayload.last_error_at = null;
      }
      
      const { error: updateError } = await supabase
        .from('whatsapp_sessions')
        .update(updatePayload)
        .eq('id', localSessionIdForDb);

      if (updateError) {
        console.error('Failed to update session status:', updateError);
      }

      // Auto-migrate references when a session connects and matches an old disconnected session's phone number
      if (dbStatus === 'connected' && responseData?.phoneNumber) {
        try {
          const { data: oldSessions } = await supabase
            .from('whatsapp_sessions')
            .select('id')
            .eq('organization_id', organizationId)
            .eq('phone_number', responseData.phoneNumber)
            .eq('status', 'disconnected')
            .neq('id', localSessionIdForDb);

          if (oldSessions?.length) {
            for (const old of oldSessions) {
              const { data: migrationResult, error: migrationError } = await supabase
                .rpc('migrate_whatsapp_session', {
                  p_old_session_id: old.id,
                  p_new_session_id: localSessionIdForDb
                });
              if (migrationError) {
                console.error(`Session migration failed ${old.id} -> ${localSessionIdForDb}:`, migrationError);
              } else {
                console.log(`Auto-migrated session ${old.id} -> ${localSessionIdForDb}:`, JSON.stringify(migrationResult));
              }
            }
          }
        } catch (migErr) {
          console.error('Session migration check failed:', migErr);
        }
      }
      
      // Return enriched response with QR code (try multiple field names)
      return new Response(
        JSON.stringify({
          ...responseData,
          qr: qrCodeValue, // Ensure qr field is populated for frontend
          sessionId: localSessionIdForDb,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update session status after successful disconnect
    if (action === 'disconnect' && localSessionIdForDb && organizationId) {
      const { error: updateError } = await supabase
        .from('whatsapp_sessions')
        .update({
          status: 'disconnected',
          phone_number: null,
          qr_code: null,
          qr_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', localSessionIdForDb);

      if (updateError) {
        console.error('Failed to update session status after disconnect:', updateError);
      } else {
        console.log(`Session ${localSessionIdForDb} marked as disconnected`);
      }

      // Also deactivate all groups belonging to this session
      const { error: groupDeactivateError } = await supabase
        .from('whatsapp_groups')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('session_id', localSessionIdForDb);

      if (groupDeactivateError) {
        console.error('Failed to deactivate groups after disconnect:', groupDeactivateError);
      } else {
        console.log(`Groups for session ${localSessionIdForDb} marked as inactive`);
      }

      // Return success to frontend
      return new Response(
        JSON.stringify({ 
          success: true, 
          status: 'disconnected',
          sessionId: localSessionIdForDb 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store groups for sync-groups action
    if (action === 'sync-groups' && isJson && localSessionIdForDb && organizationId) {
      const vpsGroups = responseData?.groups || responseData || [];
      
      // Get the connected phone number from session to determine admin status
      const { data: sessionData } = await supabase
        .from('whatsapp_sessions')
        .select('phone_number, session_data')
        .eq('id', localSessionIdForDb)
        .single();
      
      const myPhoneNumber = sessionData?.phone_number;
      const vpsSessionId = (sessionData?.session_data as any)?.vps_session_id;
      
      if (Array.isArray(vpsGroups) && vpsGroups.length > 0) {
        // First, deactivate groups from OTHER disconnected sessions in this org
        // This ensures we don't show stale groups from old/disconnected sessions
        const { data: disconnectedSessions } = await supabase
          .from('whatsapp_sessions')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('status', 'disconnected');

        if (disconnectedSessions && disconnectedSessions.length > 0) {
          const disconnectedSessionIds = disconnectedSessions.map(s => s.id);
          const { error: deactivateError } = await supabase
            .from('whatsapp_groups')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('organization_id', organizationId)
            .in('session_id', disconnectedSessionIds);

          if (deactivateError) {
            console.error('Failed to deactivate groups from disconnected sessions:', deactivateError);
          } else {
            console.log(`Deactivated groups from ${disconnectedSessionIds.length} disconnected sessions`);
          }
        }

        // Note: We no longer delete groups before sync.
        // The upsert with onConflict preserves existing UUIDs, preventing 
        // dynamic links from breaking when their referenced group IDs change.

        // Insert fresh groups from VPS
        // Filter out community parent groups — they are non-sendable containers
        // that cause WhatsApp error 420. Announcement groups (isCommunityAnnounce)
        // are still synced as they are the actual sendable targets.
        const groupsToUpsert = vpsGroups
          .filter((g: any) => g.isCommunity !== true)
          .map((g: any) => {
          // Check if the connected session user is admin
          // Baileys returns participants with admin status (admin, superadmin, or isAdmin flag)
          let isAdmin = false;
          
          if (g.participants && Array.isArray(g.participants)) {
            // Try to find myself in the participants list
            // My JID could be in format: phone@s.whatsapp.net or just the phone number
            const myParticipant = g.participants.find((p: any) => {
              const participantId = p.id || p.jid || '';
              // Check various formats
              return (
                (myPhoneNumber && participantId.includes(myPhoneNumber)) ||
                (vpsSessionId && participantId.includes(vpsSessionId.replace('wa_', '')))
              );
            });
            
            if (myParticipant) {
              // Check various admin flag formats from Baileys
              isAdmin = 
                myParticipant.admin === 'admin' ||
                myParticipant.admin === 'superadmin' ||
                myParticipant.isAdmin === true ||
                myParticipant.isSuperAdmin === true;
            }
          }
          
          // Also check if the VPS returns isAdmin directly on the group object
          if (g.isAdmin === true || g.iAmAdmin === true) {
            isAdmin = true;
          }
          
          // Extract invite link from various possible fields
          const inviteLink = g.inviteLink || g.invite_link || g.inviteCode 
            ? (g.inviteLink || g.invite_link || `https://chat.whatsapp.com/${g.inviteCode}`)
            : null;
          
          return {
            organization_id: organizationId,
            session_id: localSessionIdForDb,
            group_jid: g.id || g.jid || g.groupId,
            group_name: g.name || g.subject || 'Unknown Group',
            participant_count: Array.isArray(g.participants) 
              ? g.participants.length 
              : (g.participants || g.participantsCount || g.size || 0),
            is_active: true,
            is_admin: isAdmin,
            is_community: g.isCommunity === true,
            is_community_announce: g.isCommunityAnnounce === true,
            invite_link: inviteLink,
            synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        });
        
        const { error: upsertError } = await supabase
          .from('whatsapp_groups')
          .upsert(groupsToUpsert, { 
            onConflict: 'session_id,group_jid',
            ignoreDuplicates: false 
          });
        
        if (upsertError) {
          console.error('Failed to upsert groups:', upsertError);
          // Return error to frontend - do NOT return success
          return new Response(
            JSON.stringify({ 
              success: false, 
              upstream: 'db',
              error: 'Failed to save groups to database',
              code: upsertError.code,
              details: upsertError.message,
              vpsCount: vpsGroups.length,
              savedCount: 0
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Verify groups were actually saved by counting
        const { count: savedCount, error: countError } = await supabase
          .from('whatsapp_groups')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('session_id', localSessionIdForDb)
          .eq('is_active', true);
        
        const actualSavedCount = countError ? groupsToUpsert.length : (savedCount || 0);
        console.log(`Synced ${groupsToUpsert.length} groups from VPS, ${actualSavedCount} verified in DB`);
        
        // Return groups count to frontend
        return new Response(
          JSON.stringify({ 
            success: true, 
            groups: groupsToUpsert,
            vpsCount: vpsGroups.length,
            savedCount: actualSavedCount
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // No groups found
      return new Response(
        JSON.stringify({ success: true, groups: [], vpsCount: 0, savedCount: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle get-invite-link response - update the database with the fetched link
    if (action === 'get-invite-link' && isJson && localSessionIdForDb && groupJid) {
      const inviteCode = responseData?.inviteCode;
      const inviteLink = responseData?.inviteLink || (inviteCode ? `https://chat.whatsapp.com/${inviteCode}` : null);
      
      if (inviteLink) {
        // Update the group record with the invite link
        const { error: updateError } = await supabase
          .from('whatsapp_groups')
          .update({ 
            invite_link: inviteLink, 
            updated_at: new Date().toISOString() 
          })
          .eq('session_id', localSessionIdForDb)
          .eq('group_jid', groupJid);
        
        if (updateError) {
          console.error('Failed to update group invite link:', updateError);
        } else {
          console.log(`Updated invite link for group ${groupJid}`);
        }
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            invite_link: inviteLink,
            inviteCode,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Could not fetch invite link. You may not be admin of this group.',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      isJson ? JSON.stringify(responseData) : responseText,
      { 
        status: vpsResponse.status, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': isJson ? 'application/json' : 'text/plain' 
        } 
      }
    );

  } catch (error: unknown) {
    console.error('VPS Proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        upstream: 'proxy',
        hint: 'An unexpected error occurred in the proxy function'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
