import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

export interface WhatsAppGroup {
  id: string;
  group_jid: string;
  group_name: string;
  organization_id: string;
  session_id: string;
  participant_count: number;
  workshop_id: string | null;
  synced_at: string;
  is_active: boolean;
  is_admin: boolean;
  invite_link: string | null;
}

interface VpsErrorResponse {
  error?: string;
  upstream?: string;
  status?: number;
  hint?: string;
  suggestion?: string;
}

// Parse VPS error for better user feedback
function parseVpsError(data: VpsErrorResponse): { title: string; description: string } {
  let title = 'Sync Error';
  let description = data.error || 'An unknown error occurred';
  
  if (data.upstream === 'vps') {
    if (data.status === 401) {
      title = 'VPS Authentication Failed (401)';
      description = data.hint || 'The VPS rejected the API key.';
    } else if (data.status === 404) {
      title = 'VPS Endpoint Not Found (404)';
      description = data.hint || 'The VPS endpoint was not found.';
    } else if (data.status && data.status >= 500) {
      title = `VPS Server Error (${data.status})`;
      description = data.hint || 'The VPS service is experiencing issues.';
    }
  }
  
  return { title, description };
}

// Parse invoke error response body
async function parseInvokeError(error: unknown, response?: Response): Promise<VpsErrorResponse> {
  if (response) {
    try {
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {
        return { error: text || 'Unknown error' };
      }
    } catch {
      // Couldn't read response
    }
  }
  
  if (error instanceof Error) {
    return { error: error.message };
  }
  
  return { error: 'Unknown error occurred' };
}

export function useWhatsAppGroups() {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();

  // Fetch all groups for the organization (only from connected sessions)
  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ['whatsapp-groups', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      
      // Join with whatsapp_sessions to only get groups from connected sessions
      // This is defense-in-depth to prevent showing stale groups
      const { data, error } = await supabase
        .from('whatsapp_groups')
        .select(`
          id, group_jid, group_name, organization_id, session_id, participant_count,
          workshop_id, synced_at, is_active, is_admin, invite_link,
          session:whatsapp_sessions!inner(status)
        `)
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', true)
        .eq('session.status', 'connected')
        .order('group_name', { ascending: true });

      if (error) throw error;
      
      // Map back to WhatsAppGroup type (strip session relation)
      return (data || []).map(({ session, ...group }) => group) as WhatsAppGroup[];
    },
    enabled: !!currentOrganization,
  });

  // Sync groups from WhatsApp
  const syncMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await supabase.functions.invoke('vps-whatsapp-proxy', {
        body: {
          action: 'sync-groups',
          sessionId,
          organizationId: currentOrganization?.id,
        },
      });

      if (response.error) {
        const errorData = await parseInvokeError(response.error, (response as any).response);
        if (errorData.upstream === 'vps') {
          const { title, description } = parseVpsError(errorData);
          toast.error(title, { description });
          throw new Error(description);
        }
        throw response.error;
      }
      
      // Check for upstream VPS errors in response data
      if (response.data?.upstream === 'vps' && response.data?.status >= 400) {
        const { title, description } = parseVpsError(response.data);
        toast.error(title, { description });
        throw new Error(description);
      }
      
      // Check for database errors from the backend
      if (response.data?.upstream === 'db' && !response.data?.success) {
        const errorMsg = response.data?.details || response.data?.error || 'Database save failed';
        toast.error('Failed to save groups', { 
          description: `Error: ${errorMsg} (Code: ${response.data?.code || 'unknown'})`
        });
        throw new Error(errorMsg);
      }
      
      return response.data;
    },
    onSuccess: (data) => {
      // Immediately invalidate and refetch to update the UI
      queryClient.invalidateQueries({ queryKey: ['whatsapp-groups', currentOrganization?.id] });
      
      const savedCount = data.savedCount ?? data.groups?.length ?? 0;
      const vpsCount = data.vpsCount ?? savedCount;
      
      if (savedCount === 0 && vpsCount > 0) {
        toast.warning(`Fetched ${vpsCount} groups but none were saved`, {
          description: 'There may be a database issue. Check backend logs.'
        });
      } else {
        toast.success(`Saved ${savedCount} groups`);
      }
    },
    onError: (error: Error) => {
      // Only show generic toast if not already handled
      if (!error.message.includes('VPS') && !error.message.includes('database')) {
        toast.error('Failed to sync groups: ' + error.message);
      }
    },
  });

  // Link group to workshop
  const linkToWorkshopMutation = useMutation({
    mutationFn: async ({ groupId, workshopId }: { groupId: string; workshopId: string | null }) => {
      const { error } = await supabase
        .from('whatsapp_groups')
        .update({ workshop_id: workshopId })
        .eq('id', groupId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-groups'] });
      toast.success('Group linked to workshop');
    },
    onError: (error: Error) => {
      toast.error('Failed to link group: ' + error.message);
    },
  });

  // Get groups linked to a specific workshop
  const getWorkshopGroups = (workshopId: string) => {
    return groups?.filter(g => g.workshop_id === workshopId) || [];
  };

  // Get unlinked groups
  const unlinkedGroups = groups?.filter(g => !g.workshop_id) || [];

  // Fetch invite link for a specific group
  const fetchInviteLinkMutation = useMutation({
    mutationFn: async ({ sessionId, groupId, groupJid }: { 
      sessionId: string; 
      groupId: string;
      groupJid: string;
    }) => {
      const response = await supabase.functions.invoke('vps-whatsapp-proxy', {
        body: {
          action: 'get-invite-link',
          sessionId,
          groupJid,
          organizationId: currentOrganization?.id,
        },
      });

      if (response.error) {
        const errorData = await parseInvokeError(response.error, (response as any).response);
        throw new Error(errorData.error || 'Failed to fetch invite link');
      }
      
      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Could not get invite link');
      }
      
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-groups', currentOrganization?.id] });
      toast.success('Invite link fetched');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to get invite link');
    },
  });

  return {
    groups,
    groupsLoading,
    syncGroups: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
    linkToWorkshop: linkToWorkshopMutation.mutate,
    isLinking: linkToWorkshopMutation.isPending,
    getWorkshopGroups,
    unlinkedGroups,
    fetchInviteLink: fetchInviteLinkMutation.mutate,
    isFetchingInviteLink: fetchInviteLinkMutation.isPending,
    fetchingInviteLinkGroupId: fetchInviteLinkMutation.variables?.groupId,
  };
}
