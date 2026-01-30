import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

interface WhatsAppGroup {
  id: string;
  group_jid: string;
  group_name: string;
  organization_id: string;
  session_id: string;
  participant_count: number;
  workshop_id: string | null;
  synced_at: string;
  is_active: boolean;
}

export function useWhatsAppGroups() {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();

  // Fetch all groups for the organization
  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ['whatsapp-groups', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      
      const { data, error } = await supabase
        .from('whatsapp_groups')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', true)
        .order('group_name', { ascending: true });

      if (error) throw error;
      return data as WhatsAppGroup[];
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

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-groups'] });
      toast.success(`Synced ${data.groups?.length || 0} groups`);
    },
    onError: (error: Error) => {
      toast.error('Failed to sync groups: ' + error.message);
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

  return {
    groups,
    groupsLoading,
    syncGroups: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
    linkToWorkshop: linkToWorkshopMutation.mutate,
    isLinking: linkToWorkshopMutation.isPending,
    getWorkshopGroups,
    unlinkedGroups,
  };
}
