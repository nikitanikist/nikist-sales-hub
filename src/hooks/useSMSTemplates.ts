import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export interface SMSTemplateVariable {
  key: string;
  label: string;
}

export interface SMSTemplate {
  id: string;
  organization_id: string;
  dlt_template_id: string;
  name: string;
  content_preview: string;
  variables: SMSTemplateVariable[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSMSTemplateInput {
  dlt_template_id: string;
  name: string;
  content_preview: string;
  variables?: SMSTemplateVariable[];
}

export interface UpdateSMSTemplateInput extends Partial<CreateSMSTemplateInput> {
  id: string;
}

// Helper to safely parse variables from JSONB
function parseVariables(variables: Json | null): SMSTemplateVariable[] {
  if (!variables || !Array.isArray(variables)) return [];
  return variables
    .filter((v): v is { key: string; label: string } & Record<string, Json> => 
      typeof v === 'object' && v !== null && 'key' in v && 'label' in v &&
      typeof (v as Record<string, unknown>).key === 'string' && 
      typeof (v as Record<string, unknown>).label === 'string'
    )
    .map(v => ({ key: v.key as string, label: v.label as string }));
}

export function useSMSTemplates() {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();

  // Fetch all SMS templates for the organization
  const { data: templates, isLoading: templatesLoading, error } = useQuery({
    queryKey: ['sms-templates', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      
      const { data, error } = await supabase
        .from('sms_templates')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      
      // Parse variables from JSONB
      return (data || []).map(t => ({
        ...t,
        variables: parseVariables(t.variables as Json)
      })) as SMSTemplate[];
    },
    enabled: !!currentOrganization,
  });

  // Create template
  const createMutation = useMutation({
    mutationFn: async (input: CreateSMSTemplateInput) => {
      if (!currentOrganization) throw new Error('No organization selected');
      
      const { data, error } = await supabase
        .from('sms_templates')
        .insert({
          organization_id: currentOrganization.id,
          dlt_template_id: input.dlt_template_id,
          name: input.name,
          content_preview: input.content_preview,
          variables: (input.variables || []) as unknown as Json,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-templates'] });
      toast.success('SMS template added successfully');
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate key')) {
        toast.error('Template already exists', { description: 'A template with this DLT ID already exists.' });
      } else {
        toast.error('Failed to add template', { description: error.message });
      }
    },
  });

  // Update template
  const updateMutation = useMutation({
    mutationFn: async (input: UpdateSMSTemplateInput) => {
      const { id, ...updates } = input;
      
      // Build update object with proper typing
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.dlt_template_id !== undefined) updateData.dlt_template_id = updates.dlt_template_id;
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.content_preview !== undefined) updateData.content_preview = updates.content_preview;
      if (updates.variables !== undefined) updateData.variables = updates.variables as unknown as Json;
      
      const { data, error } = await supabase
        .from('sms_templates')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-templates'] });
      toast.success('SMS template updated successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to update template', { description: error.message });
    },
  });

  // Delete template (soft delete by setting is_active = false)
  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from('sms_templates')
        .update({ is_active: false })
        .eq('id', templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-templates'] });
      toast.success('SMS template deleted successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete template', { description: error.message });
    },
  });

  // Bulk create templates for import
  const bulkCreateMutation = useMutation({
    mutationFn: async (inputTemplates: CreateSMSTemplateInput[]) => {
      if (!currentOrganization) throw new Error('No organization selected');
      
      const { data, error } = await supabase
        .from('sms_templates')
        .insert(inputTemplates.map(t => ({
          organization_id: currentOrganization.id,
          dlt_template_id: t.dlt_template_id,
          name: t.name,
          content_preview: t.content_preview,
          variables: (t.variables || []) as unknown as Json,
        })))
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sms-templates'] });
      toast.success(`${data.length} SMS templates imported successfully`);
    },
    onError: (error: Error) => {
      toast.error('Failed to import templates', { description: error.message });
    },
  });

  return {
    templates: templates || [],
    templatesLoading,
    error,
    createTemplate: createMutation.mutate,
    createTemplateAsync: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateTemplate: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    deleteTemplate: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    bulkCreateTemplates: bulkCreateMutation.mutateAsync,
    isBulkCreating: bulkCreateMutation.isPending,
  };
}
