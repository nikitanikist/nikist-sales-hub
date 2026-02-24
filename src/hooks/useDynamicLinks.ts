import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface DynamicLink {
  id: string;
  organization_id: string;
  slug: string;
  destination_url: string | null;
  whatsapp_group_id: string | null;
  click_count: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateLinkData {
  slug: string;
  destination_url: string;
}

export interface UpdateLinkData {
  id: string;
  slug?: string;
  destination_url?: string;
  is_active?: boolean;
}

export function useDynamicLinks() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all dynamic links for the organization
  const { data: links, isLoading } = useQuery({
    queryKey: ['dynamic-links', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      
      const { data, error } = await supabase
        .from('dynamic_links')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as DynamicLink[];
    },
    enabled: !!currentOrganization,
  });

  // Create a new dynamic link
  const createMutation = useMutation({
    mutationFn: async (data: CreateLinkData) => {
      if (!currentOrganization || !user) {
        throw new Error('Organization or user not found');
      }

      const { data: result, error } = await supabase
        .from('dynamic_links')
        .insert({
          organization_id: currentOrganization.id,
          slug: data.slug.toLowerCase().trim(),
          destination_url: data.destination_url,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('This slug is already in use');
        }
        throw error;
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dynamic-links', currentOrganization?.id] });
      toast.success('Link created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Update an existing dynamic link
  const updateMutation = useMutation({
    mutationFn: async (data: UpdateLinkData) => {
      const { id, ...updates } = data;
      
      // If changing slug, normalize it
      if (updates.slug) {
        updates.slug = updates.slug.toLowerCase().trim();
      }

      const { data: result, error } = await supabase
        .from('dynamic_links')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('This slug is already in use');
        }
        throw error;
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dynamic-links', currentOrganization?.id] });
      toast.success('Link updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete a dynamic link
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('dynamic_links')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dynamic-links', currentOrganization?.id] });
      toast.success('Link deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete link: ' + error.message);
    },
  });

  return {
    links,
    isLoading,
    createLink: createMutation.mutate,
    isCreating: createMutation.isPending,
    updateLink: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    deleteLink: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
}

// Hook for public redirect - no auth required
export function usePublicLinkRedirect(slug: string) {
  return useQuery({
    queryKey: ['public-link', slug],
    queryFn: async () => {
      // Call the RPC function that increments click and returns destination
      const { data, error } = await supabase
        .rpc('increment_link_click', { link_slug: slug });

      if (error) throw error;
      
      if (!data || data.length === 0) {
        return null;
      }

      // Return the destination URL directly
      const result = data[0];
      return result.destination_url || null;
    },
    enabled: !!slug,
    retry: false,
    staleTime: 0, // Always fetch fresh for accurate click tracking
  });
}
