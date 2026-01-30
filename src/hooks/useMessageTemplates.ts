import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

export interface MessageTemplate {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  content: string;
  media_url: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  content: string;
  media_url?: string | null;
  is_default?: boolean;
}

export interface UpdateTemplateInput extends Partial<CreateTemplateInput> {
  id: string;
}

// Template variables that can be used in message content
export const TEMPLATE_VARIABLES = [
  { key: '{workshop_name}', description: 'Name of the workshop' },
  { key: '{date}', description: 'Workshop date' },
  { key: '{time}', description: 'Workshop time' },
  { key: '{zoom_link}', description: 'Zoom meeting link' },
  { key: '{whatsapp_group_link}', description: 'WhatsApp group invite link' },
];

export function useMessageTemplates() {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();

  // Fetch all templates for the organization
  const { data: templates, isLoading: templatesLoading, error } = useQuery({
    queryKey: ['message-templates', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      
      const { data, error } = await supabase
        .from('whatsapp_message_templates')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('name', { ascending: true });

      if (error) throw error;
      return data as MessageTemplate[];
    },
    enabled: !!currentOrganization,
  });

  // Create template
  const createMutation = useMutation({
    mutationFn: async (input: CreateTemplateInput) => {
      if (!currentOrganization) throw new Error('No organization selected');
      
      const { data, error } = await supabase
        .from('whatsapp_message_templates')
        .insert({
          organization_id: currentOrganization.id,
          name: input.name,
          description: input.description || null,
          content: input.content,
          media_url: input.media_url || null,
          is_default: input.is_default || false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast.success('Template created successfully');
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
        .from('whatsapp_message_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      queryClient.invalidateQueries({ queryKey: ['template-sequences'] });
      toast.success('Template updated successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to update template', { description: error.message });
    },
  });

  // Delete template
  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from('whatsapp_message_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      queryClient.invalidateQueries({ queryKey: ['template-sequences'] });
      toast.success('Template deleted successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete template', { description: error.message });
    },
  });

  // Helper function to apply template variables
  const applyTemplateVariables = (
    content: string,
    variables: Record<string, string>
  ): string => {
    let result = content;
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    });
    return result;
  };

  return {
    templates: templates || [],
    templatesLoading,
    error,
    createTemplate: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateTemplate: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    deleteTemplate: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    applyTemplateVariables,
  };
}
