import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

export interface TemplateSequenceStep {
  id: string;
  sequence_id: string;
  template_id: string;
  send_time: string; // TIME format "HH:MM:SS"
  time_label: string | null;
  step_order: number;
  created_at: string;
  // Joined data
  template?: {
    id: string;
    name: string;
    content: string;
    media_url: string | null;
  } | null;
}

export interface TemplateSequence {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  steps?: TemplateSequenceStep[];
}

export interface CreateSequenceInput {
  name: string;
  description?: string;
}

export interface UpdateSequenceInput extends Partial<CreateSequenceInput> {
  id: string;
}

export interface CreateStepInput {
  sequence_id: string;
  template_id: string;
  send_time: string;
  time_label?: string;
  step_order: number;
}

export interface UpdateStepInput extends Partial<Omit<CreateStepInput, 'sequence_id'>> {
  id: string;
}

export function useTemplateSequences() {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();

  // Fetch all sequences for the organization with their steps
  const { data: sequences, isLoading: sequencesLoading, error } = useQuery({
    queryKey: ['template-sequences', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      
      const { data, error } = await supabase
        .from('template_sequences')
        .select(`
          *,
          steps:template_sequence_steps(
            *,
            template:whatsapp_message_templates(id, name, content, media_url)
          )
        `)
        .eq('organization_id', currentOrganization.id)
        .order('name', { ascending: true });

      if (error) throw error;
      
      // Sort steps by step_order
      return (data || []).map(seq => ({
        ...seq,
        steps: (seq.steps || []).sort((a: TemplateSequenceStep, b: TemplateSequenceStep) => a.step_order - b.step_order)
      })) as TemplateSequence[];
    },
    enabled: !!currentOrganization,
  });

  // Fetch single sequence with steps
  const useSequence = (sequenceId: string | null) => {
    return useQuery({
      queryKey: ['template-sequence', sequenceId],
      queryFn: async () => {
        if (!sequenceId) return null;
        
        const { data, error } = await supabase
          .from('template_sequences')
          .select(`
            *,
            steps:template_sequence_steps(
              *,
              template:whatsapp_message_templates(id, name, content, media_url)
            )
          `)
          .eq('id', sequenceId)
          .single();

        if (error) throw error;
        
        // Sort steps
        return {
          ...data,
          steps: (data.steps || []).sort((a: TemplateSequenceStep, b: TemplateSequenceStep) => a.step_order - b.step_order)
        } as TemplateSequence;
      },
      enabled: !!sequenceId,
    });
  };

  // Create sequence
  const createSequenceMutation = useMutation({
    mutationFn: async (input: CreateSequenceInput) => {
      if (!currentOrganization) throw new Error('No organization selected');
      
      const { data, error } = await supabase
        .from('template_sequences')
        .insert({
          organization_id: currentOrganization.id,
          name: input.name,
          description: input.description || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-sequences'] });
      toast.success('Sequence created successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to create sequence', { description: error.message });
    },
  });

  // Update sequence
  const updateSequenceMutation = useMutation({
    mutationFn: async (input: UpdateSequenceInput) => {
      const { id, ...updates } = input;
      
      const { data, error } = await supabase
        .from('template_sequences')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-sequences'] });
      toast.success('Sequence updated successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to update sequence', { description: error.message });
    },
  });

  // Delete sequence
  const deleteSequenceMutation = useMutation({
    mutationFn: async (sequenceId: string) => {
      const { error } = await supabase
        .from('template_sequences')
        .delete()
        .eq('id', sequenceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-sequences'] });
      queryClient.invalidateQueries({ queryKey: ['workshop-tags'] });
      toast.success('Sequence deleted successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete sequence', { description: error.message });
    },
  });

  // Create step
  const createStepMutation = useMutation({
    mutationFn: async (input: CreateStepInput) => {
      const { data, error } = await supabase
        .from('template_sequence_steps')
        .insert({
          sequence_id: input.sequence_id,
          template_id: input.template_id,
          send_time: input.send_time,
          time_label: input.time_label || null,
          step_order: input.step_order,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-sequences'] });
      queryClient.invalidateQueries({ queryKey: ['template-sequence'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to add step', { description: error.message });
    },
  });

  // Update step
  const updateStepMutation = useMutation({
    mutationFn: async (input: UpdateStepInput) => {
      const { id, ...updates } = input;
      
      const { data, error } = await supabase
        .from('template_sequence_steps')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-sequences'] });
      queryClient.invalidateQueries({ queryKey: ['template-sequence'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to update step', { description: error.message });
    },
  });

  // Delete step
  const deleteStepMutation = useMutation({
    mutationFn: async (stepId: string) => {
      const { error } = await supabase
        .from('template_sequence_steps')
        .delete()
        .eq('id', stepId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-sequences'] });
      queryClient.invalidateQueries({ queryKey: ['template-sequence'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to remove step', { description: error.message });
    },
  });

  return {
    sequences: sequences || [],
    sequencesLoading,
    error,
    useSequence,
    // Sequence CRUD
    createSequence: createSequenceMutation.mutateAsync,
    isCreatingSequence: createSequenceMutation.isPending,
    updateSequence: updateSequenceMutation.mutate,
    isUpdatingSequence: updateSequenceMutation.isPending,
    deleteSequence: deleteSequenceMutation.mutate,
    isDeletingSequence: deleteSequenceMutation.isPending,
    // Step CRUD
    createStep: createStepMutation.mutateAsync,
    isCreatingStep: createStepMutation.isPending,
    updateStep: updateStepMutation.mutate,
    isUpdatingStep: updateStepMutation.isPending,
    deleteStep: deleteStepMutation.mutate,
    isDeletingStep: deleteStepMutation.isPending,
  };
}
