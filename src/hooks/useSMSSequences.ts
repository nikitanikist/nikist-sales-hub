import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

export interface SMSSequenceStep {
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
    dlt_template_id: string;
    content_preview: string;
  } | null;
}

export interface SMSSequence {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  steps?: SMSSequenceStep[];
}

export interface CreateSMSSequenceInput {
  name: string;
  description?: string;
}

export interface UpdateSMSSequenceInput extends Partial<CreateSMSSequenceInput> {
  id: string;
}

export interface CreateSMSStepInput {
  sequence_id: string;
  template_id: string;
  send_time: string;
  time_label?: string;
  step_order: number;
}

export interface UpdateSMSStepInput extends Partial<Omit<CreateSMSStepInput, 'sequence_id'>> {
  id: string;
}

// Helper to get next step_order based on MAX existing order
export function getNextSMSStepOrder(steps: SMSSequenceStep[] | undefined): number {
  if (!steps || steps.length === 0) return 1;
  return Math.max(...steps.map(s => s.step_order)) + 1;
}

// Helper to reorder steps after deletion
async function reorderStepsAfterDelete(sequenceId: string, deletedOrder: number) {
  const { data: stepsToUpdate } = await supabase
    .from('sms_sequence_steps')
    .select('id, step_order')
    .eq('sequence_id', sequenceId)
    .gt('step_order', deletedOrder)
    .order('step_order', { ascending: true });

  if (stepsToUpdate && stepsToUpdate.length > 0) {
    for (const step of stepsToUpdate) {
      await supabase
        .from('sms_sequence_steps')
        .update({ step_order: step.step_order - 1 })
        .eq('id', step.id);
    }
  }
}

export function useSMSSequences() {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();

  // Fetch all SMS sequences for the organization with their steps
  const { data: sequences, isLoading: sequencesLoading, error } = useQuery({
    queryKey: ['sms-sequences', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      
      const { data, error } = await supabase
        .from('sms_sequences')
        .select(`
          *,
          steps:sms_sequence_steps(
            *,
            template:sms_templates(id, name, dlt_template_id, content_preview)
          )
        `)
        .eq('organization_id', currentOrganization.id)
        .order('name', { ascending: true });

      if (error) throw error;
      
      // Sort steps by step_order
      return (data || []).map(seq => ({
        ...seq,
        steps: (seq.steps || []).sort((a: SMSSequenceStep, b: SMSSequenceStep) => a.step_order - b.step_order)
      })) as SMSSequence[];
    },
    enabled: !!currentOrganization,
  });

  // Fetch single sequence with steps
  const useSequence = (sequenceId: string | null) => {
    return useQuery({
      queryKey: ['sms-sequence', sequenceId],
      queryFn: async () => {
        if (!sequenceId) return null;
        
        const { data, error } = await supabase
          .from('sms_sequences')
          .select(`
            *,
            steps:sms_sequence_steps(
              *,
              template:sms_templates(id, name, dlt_template_id, content_preview)
            )
          `)
          .eq('id', sequenceId)
          .single();

        if (error) throw error;
        
        // Sort steps
        return {
          ...data,
          steps: (data.steps || []).sort((a: SMSSequenceStep, b: SMSSequenceStep) => a.step_order - b.step_order)
        } as SMSSequence;
      },
      enabled: !!sequenceId,
    });
  };

  // Create sequence
  const createSequenceMutation = useMutation({
    mutationFn: async (input: CreateSMSSequenceInput) => {
      if (!currentOrganization) throw new Error('No organization selected');
      
      const { data, error } = await supabase
        .from('sms_sequences')
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
      queryClient.invalidateQueries({ queryKey: ['sms-sequences'] });
      toast.success('SMS sequence created successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to create sequence', { description: error.message });
    },
  });

  // Update sequence
  const updateSequenceMutation = useMutation({
    mutationFn: async (input: UpdateSMSSequenceInput) => {
      const { id, ...updates } = input;
      
      const { data, error } = await supabase
        .from('sms_sequences')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-sequences'] });
      toast.success('SMS sequence updated successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to update sequence', { description: error.message });
    },
  });

  // Delete sequence
  const deleteSequenceMutation = useMutation({
    mutationFn: async (sequenceId: string) => {
      const { error } = await supabase
        .from('sms_sequences')
        .delete()
        .eq('id', sequenceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-sequences'] });
      queryClient.invalidateQueries({ queryKey: ['workshop-tags'] });
      toast.success('SMS sequence deleted successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete sequence', { description: error.message });
    },
  });

  // Create step
  const createStepMutation = useMutation({
    mutationFn: async (input: CreateSMSStepInput) => {
      const { data, error } = await supabase
        .from('sms_sequence_steps')
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
      queryClient.invalidateQueries({ queryKey: ['sms-sequences'] });
      queryClient.invalidateQueries({ queryKey: ['sms-sequence'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to add step', { description: error.message });
    },
  });

  // Update step
  const updateStepMutation = useMutation({
    mutationFn: async (input: UpdateSMSStepInput) => {
      const { id, ...updates } = input;
      
      const { data, error } = await supabase
        .from('sms_sequence_steps')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-sequences'] });
      queryClient.invalidateQueries({ queryKey: ['sms-sequence'] });
      toast.success('Step updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update step', { description: error.message });
    },
  });

  // Delete step with reordering
  const deleteStepMutation = useMutation({
    mutationFn: async ({ stepId, sequenceId, stepOrder }: { stepId: string; sequenceId: string; stepOrder: number }) => {
      const { error } = await supabase
        .from('sms_sequence_steps')
        .delete()
        .eq('id', stepId);

      if (error) throw error;

      // Reorder remaining steps to close the gap
      await reorderStepsAfterDelete(sequenceId, stepOrder);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-sequences'] });
      queryClient.invalidateQueries({ queryKey: ['sms-sequence'] });
      toast.success('Step removed');
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
    getNextStepOrder: getNextSMSStepOrder,
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
    updateStepAsync: updateStepMutation.mutateAsync,
    isUpdatingStep: updateStepMutation.isPending,
    deleteStepAsync: deleteStepMutation.mutateAsync,
    isDeletingStep: deleteStepMutation.isPending,
  };
}
