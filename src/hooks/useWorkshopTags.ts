import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

export interface WorkshopTag {
  id: string;
  organization_id: string;
  name: string;
  color: string | null;
  description: string | null;
  template_sequence_id: string | null;
  sms_sequence_id: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  template_sequence?: {
    id: string;
    name: string;
  } | null;
  sms_sequence?: {
    id: string;
    name: string;
  } | null;
}

export interface CreateTagInput {
  name: string;
  color?: string;
  description?: string;
  template_sequence_id?: string | null;
  sms_sequence_id?: string | null;
}

export interface UpdateTagInput extends Partial<CreateTagInput> {
  id: string;
}

export const TAG_COLORS = [
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#10B981' },
  { name: 'Yellow', value: '#F59E0B' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Cyan', value: '#06B6D4' },
];

export function useWorkshopTags() {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();

  // Fetch all tags for the organization with their sequences
  const { data: tags, isLoading: tagsLoading, error } = useQuery({
    queryKey: ['workshop-tags', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      
      const { data, error } = await supabase
        .from('workshop_tags')
        .select(`
          *,
          template_sequence:template_sequences(id, name),
          sms_sequence:sms_sequences(id, name)
        `)
        .eq('organization_id', currentOrganization.id)
        .order('name', { ascending: true });

      if (error) throw error;
      return data as WorkshopTag[];
    },
    enabled: !!currentOrganization,
  });

  // Create tag
  const createMutation = useMutation({
    mutationFn: async (input: CreateTagInput) => {
      if (!currentOrganization) throw new Error('No organization selected');
      
      const { data, error } = await supabase
        .from('workshop_tags')
        .insert({
          organization_id: currentOrganization.id,
          name: input.name,
          color: input.color || '#8B5CF6',
          description: input.description || null,
          template_sequence_id: input.template_sequence_id || null,
          sms_sequence_id: input.sms_sequence_id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshop-tags'] });
      toast.success('Tag created successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to create tag', { description: error.message });
    },
  });

  // Update tag
  const updateMutation = useMutation({
    mutationFn: async (input: UpdateTagInput) => {
      const { id, ...updates } = input;
      
      const { data, error } = await supabase
        .from('workshop_tags')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshop-tags'] });
      queryClient.invalidateQueries({ queryKey: ['workshops'] });
      toast.success('Tag updated successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to update tag', { description: error.message });
    },
  });

  // Delete tag
  const deleteMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase
        .from('workshop_tags')
        .delete()
        .eq('id', tagId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshop-tags'] });
      queryClient.invalidateQueries({ queryKey: ['workshops'] });
      toast.success('Tag deleted successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete tag', { description: error.message });
    },
  });

  // Set default tag (only one can be default per organization)
  const setDefaultMutation = useMutation({
    mutationFn: async (tagId: string | null) => {
      if (!currentOrganization) throw new Error('No organization selected');
      
      // First, unset all defaults for this organization
      const { error: unsetError } = await supabase
        .from('workshop_tags')
        .update({ is_default: false })
        .eq('organization_id', currentOrganization.id)
        .eq('is_default', true);

      if (unsetError) throw unsetError;

      // If tagId is null, we're just clearing the default
      if (!tagId) return null;

      // Set the new default
      const { data, error } = await supabase
        .from('workshop_tags')
        .update({ is_default: true })
        .eq('id', tagId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workshop-tags'] });
      if (data) {
        toast.success(`"${data.name}" set as default tag for new workshops`);
      } else {
        toast.success('Default tag cleared');
      }
    },
    onError: (error: Error) => {
      toast.error('Failed to set default tag', { description: error.message });
    },
  });

  // Get the current default tag
  const defaultTag = tags?.find(t => t.is_default) || null;

  return {
    tags: tags || [],
    tagsLoading,
    error,
    createTag: createMutation.mutate,
    isCreating: createMutation.isPending,
    updateTag: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    deleteTag: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    setDefaultTag: setDefaultMutation.mutate,
    isSettingDefault: setDefaultMutation.isPending,
    defaultTag,
  };
}
