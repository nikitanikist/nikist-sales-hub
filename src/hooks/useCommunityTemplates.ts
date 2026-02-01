import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

export interface CommunityTemplate {
  id: string;
  organization_id: string;
  tag_id: string;
  profile_picture_url: string | null;
  description_template: string;
  created_at: string;
  updated_at: string;
  // Joined data
  tag?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

export interface CreateTemplateInput {
  tag_id: string;
  profile_picture_url?: string | null;
  description_template: string;
}

export interface UpdateTemplateInput extends Partial<CreateTemplateInput> {
  id: string;
}

// Supported template variables for community descriptions
export const COMMUNITY_TEMPLATE_VARIABLES = [
  { key: '{workshop_name}', description: 'Full workshop title' },
  { key: '{workshop_title}', description: 'Title part before "<>"' },
  { key: '{workshop_date}', description: 'Date part after "<>" (e.g., "1st February")' },
  { key: '{start_time}', description: 'Formatted start time (e.g., "7:00 PM IST")' },
];

export function useCommunityTemplates() {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();

  // Fetch all templates for the organization
  const { data: templates, isLoading: templatesLoading, error } = useQuery({
    queryKey: ['community-templates', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      
      const { data, error } = await supabase
        .from('community_templates')
        .select(`
          *,
          tag:workshop_tags(id, name, color)
        `)
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CommunityTemplate[];
    },
    enabled: !!currentOrganization,
  });

  // Create template
  const createMutation = useMutation({
    mutationFn: async (input: CreateTemplateInput) => {
      if (!currentOrganization) throw new Error('No organization selected');
      
      const { data, error } = await supabase
        .from('community_templates')
        .insert({
          organization_id: currentOrganization.id,
          tag_id: input.tag_id,
          profile_picture_url: input.profile_picture_url || null,
          description_template: input.description_template,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-templates'] });
      toast.success('Community template created');
    },
    onError: (error: Error) => {
      toast.error('Failed to create template', { description: error.message });
    },
  });

  // Update template
  const updateMutation = useMutation({
    mutationFn: async (input: UpdateTemplateInput) => {
      const { id, ...updates } = input;
      
      const { data, error } = await supabase
        .from('community_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-templates'] });
      toast.success('Community template updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update template', { description: error.message });
    },
  });

  // Delete template
  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from('community_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-templates'] });
      toast.success('Community template deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete template', { description: error.message });
    },
  });

  // Get template by tag_id
  const getTemplateByTagId = (tagId: string) => {
    return templates?.find(t => t.tag_id === tagId) || null;
  };

  return {
    templates: templates || [],
    templatesLoading,
    error,
    createTemplate: createMutation.mutate,
    isCreating: createMutation.isPending,
    updateTemplate: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    deleteTemplate: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    getTemplateByTagId,
  };
}
