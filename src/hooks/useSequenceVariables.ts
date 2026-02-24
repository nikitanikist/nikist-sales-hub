import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

export interface SequenceVariable {
  id: string;
  variable_key: string;
  variable_value: string;
  created_at: string;
  updated_at: string;
}

export function useSequenceVariables(entityId: string | null, entityType: 'workshop' | 'webinar' = 'workshop') {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();

  const queryKey = entityType === 'webinar' 
    ? ['webinar-sequence-variables', entityId]
    : ['workshop-sequence-variables', entityId];

  const { data: savedVariables, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!entityId) return [];
      
      if (entityType === 'webinar') {
        const { data, error } = await supabase
          .from('webinar_sequence_variables')
          .select('*')
          .eq('webinar_id', entityId);
        if (error) throw error;
        return (data || []) as SequenceVariable[];
      } else {
        const { data, error } = await supabase
          .from('workshop_sequence_variables')
          .select('*')
          .eq('workshop_id', entityId);
        if (error) throw error;
        return (data || []) as SequenceVariable[];
      }
    },
    enabled: !!entityId,
  });

  const variablesMap: Record<string, string> = {};
  savedVariables?.forEach(v => {
    variablesMap[v.variable_key] = v.variable_value;
  });

  const saveVariablesMutation = useMutation({
    mutationFn: async ({ 
      workshopId, 
      variables 
    }: { 
      workshopId: string; 
      variables: Record<string, string> 
    }) => {
      if (!currentOrganization) throw new Error('No organization selected');
      
      for (const [key, value] of Object.entries(variables)) {
        if (entityType === 'webinar') {
          const { error } = await supabase
            .from('webinar_sequence_variables')
            .upsert({
              webinar_id: workshopId,
              variable_key: key,
              variable_value: value,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'webinar_id,variable_key' });
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('workshop_sequence_variables')
            .upsert({
              organization_id: currentOrganization.id,
              workshop_id: workshopId,
              variable_key: key,
              variable_value: value,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'workshop_id,variable_key' });
          if (error) throw error;
        }
      }
      
      return { count: Object.keys(variables).length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => {
      toast.error('Failed to save variables', { description: error.message });
    },
  });

  return {
    savedVariables: savedVariables || [],
    variablesMap,
    isLoading,
    saveVariables: saveVariablesMutation.mutateAsync,
    isSaving: saveVariablesMutation.isPending,
  };
}
