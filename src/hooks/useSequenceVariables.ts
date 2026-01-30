import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

export interface SequenceVariable {
  id: string;
  organization_id: string;
  workshop_id: string;
  variable_key: string;
  variable_value: string;
  created_at: string;
  updated_at: string;
}

export function useSequenceVariables(workshopId: string | null) {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();

  // Fetch saved variables for this workshop
  const { data: savedVariables, isLoading } = useQuery({
    queryKey: ['workshop-sequence-variables', workshopId],
    queryFn: async () => {
      if (!workshopId) return [];
      
      const { data, error } = await supabase
        .from('workshop_sequence_variables')
        .select('*')
        .eq('workshop_id', workshopId);

      if (error) throw error;
      return data as SequenceVariable[];
    },
    enabled: !!workshopId,
  });

  // Convert to a key-value map for easy access
  const variablesMap: Record<string, string> = {};
  savedVariables?.forEach(v => {
    variablesMap[v.variable_key] = v.variable_value;
  });

  // Save/update variables mutation
  const saveVariablesMutation = useMutation({
    mutationFn: async ({ 
      workshopId, 
      variables 
    }: { 
      workshopId: string; 
      variables: Record<string, string> 
    }) => {
      if (!currentOrganization) throw new Error('No organization selected');
      
      // Upsert each variable
      for (const [key, value] of Object.entries(variables)) {
        const { error } = await supabase
          .from('workshop_sequence_variables')
          .upsert({
            organization_id: currentOrganization.id,
            workshop_id: workshopId,
            variable_key: key,
            variable_value: value,
            updated_at: new Date().toISOString(),
          }, { 
            onConflict: 'workshop_id,variable_key' 
          });
        
        if (error) throw error;
      }
      
      return { count: Object.keys(variables).length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshop-sequence-variables'] });
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
