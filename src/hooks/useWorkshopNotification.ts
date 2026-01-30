import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';
import { useEffect } from 'react';
import { format, parse, setHours, setMinutes, setSeconds, isBefore } from 'date-fns';

export interface ScheduledMessage {
  id: string;
  organization_id: string;
  group_id: string;
  workshop_id: string;
  message_type: string;
  message_content: string;
  media_url: string | null;
  media_type: string | null;
  scheduled_for: string;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled';
  sent_at: string | null;
  error_message: string | null;
  retry_count: number;
  created_by: string | null;
  created_at: string;
}

export interface WorkshopWithDetails {
  id: string;
  title: string;
  start_date: string;
  organization_id: string;
  tag_id: string | null;
  whatsapp_group_id: string | null;
  whatsapp_session_id: string | null;
  automation_status: {
    whatsapp_group_linked: boolean;
    messages_scheduled: boolean;
  };
  // Joined data
  tag?: {
    id: string;
    name: string;
    color: string;
    template_sequence_id: string | null;
  } | null;
  whatsapp_group?: {
    id: string;
    group_name: string;
    group_jid: string;
  } | null;
  registrations_count?: number;
}

export function useWorkshopNotification() {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();

  // Fetch workshops with their tags, groups, and registration counts
  const { data: workshops, isLoading: workshopsLoading, error } = useQuery({
    queryKey: ['workshop-notifications', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      
      // Fetch workshops with joins
      const { data: workshopsData, error: workshopsError } = await supabase
        .from('workshops')
        .select(`
          id, title, start_date, organization_id, tag_id, whatsapp_group_id, whatsapp_session_id, automation_status,
          tag:workshop_tags(id, name, color, template_sequence_id),
          whatsapp_group:whatsapp_groups!workshops_whatsapp_group_id_fkey(id, group_name, group_jid)
        `)
        .eq('organization_id', currentOrganization.id)
        .order('start_date', { ascending: false });

      if (workshopsError) throw workshopsError;
      
      // If no workshops, return empty array
      if (!workshopsData || workshopsData.length === 0) return [];
      
      // Fetch registration counts
      const workshopIds = workshopsData.map(w => w.id);
      
      const { data: countData, error: countError } = await supabase
        .from('lead_assignments')
        .select('workshop_id')
        .in('workshop_id', workshopIds);
      
      if (countError) throw countError;
      
      // Count per workshop
      const countMap: Record<string, number> = {};
      (countData || []).forEach(la => {
        if (la.workshop_id) {
          countMap[la.workshop_id] = (countMap[la.workshop_id] || 0) + 1;
        }
      });
      
      return (workshopsData || []).map(w => ({
        ...w,
        registrations_count: countMap[w.id] || 0,
      })) as WorkshopWithDetails[];
    },
    enabled: !!currentOrganization,
  });

  // Fetch scheduled messages for a specific workshop
  const useWorkshopMessages = (workshopId: string | null) => {
    return useQuery({
      queryKey: ['workshop-messages', workshopId],
      queryFn: async () => {
        if (!workshopId) return [];
        
        const { data, error } = await supabase
          .from('scheduled_whatsapp_messages')
          .select('*')
          .eq('workshop_id', workshopId)
          .order('scheduled_for', { ascending: true });

        if (error) throw error;
        return data as ScheduledMessage[];
      },
      enabled: !!workshopId,
    });
  };

  // Subscribe to real-time updates for a workshop's messages
  const subscribeToMessages = (workshopId: string) => {
    const channel = supabase
      .channel(`workshop-messages-${workshopId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scheduled_whatsapp_messages',
          filter: `workshop_id=eq.${workshopId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['workshop-messages', workshopId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  // Update workshop tag
  const updateTagMutation = useMutation({
    mutationFn: async ({ workshopId, tagId }: { workshopId: string; tagId: string | null }) => {
      const { error } = await supabase
        .from('workshops')
        .update({ tag_id: tagId })
        .eq('id', workshopId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshop-notifications'] });
      toast.success('Workshop tag updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update tag', { description: error.message });
    },
  });

  // Update workshop WhatsApp session
  const updateSessionMutation = useMutation({
    mutationFn: async ({ workshopId, sessionId }: { workshopId: string; sessionId: string | null }) => {
      const { error } = await supabase
        .from('workshops')
        .update({ whatsapp_session_id: sessionId })
        .eq('id', workshopId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshop-notifications'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to update WhatsApp account', { description: error.message });
    },
  });

  // Update workshop WhatsApp group
  const updateGroupMutation = useMutation({
    mutationFn: async ({ workshopId, groupId }: { workshopId: string; groupId: string | null }) => {
      const { error } = await supabase
        .from('workshops')
        .update({ 
          whatsapp_group_id: groupId,
          automation_status: {
            whatsapp_group_linked: !!groupId,
            messages_scheduled: false,
          },
        })
        .eq('id', workshopId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshop-notifications'] });
      toast.success('WhatsApp group linked');
    },
    onError: (error: Error) => {
      toast.error('Failed to link group', { description: error.message });
    },
  });

  // Run the messaging - schedule all messages based on tag's sequence
  const runMessagingMutation = useMutation({
    mutationFn: async ({ 
      workshopId, 
      workshop 
    }: { 
      workshopId: string; 
      workshop: WorkshopWithDetails;
    }) => {
      if (!currentOrganization) throw new Error('No organization selected');
      if (!workshop.whatsapp_group_id) throw new Error('No WhatsApp group linked');
      if (!workshop.tag?.template_sequence_id) throw new Error('No template sequence assigned to the tag');
      
      // Fetch the sequence with steps
      const { data: sequenceData, error: seqError } = await supabase
        .from('template_sequences')
        .select(`
          *,
          steps:template_sequence_steps(
            *,
            template:whatsapp_message_templates(id, name, content, media_url)
          )
        `)
        .eq('id', workshop.tag.template_sequence_id)
        .single();
      
      if (seqError) throw seqError;
      if (!sequenceData?.steps?.length) throw new Error('Sequence has no steps configured');
      
      // Parse workshop date
      const workshopDate = new Date(workshop.start_date);
      const now = new Date();
      
      // Check for existing scheduled messages to avoid duplicates
      const { data: existingMessages } = await supabase
        .from('scheduled_whatsapp_messages')
        .select('message_type')
        .eq('workshop_id', workshopId)
        .in('status', ['pending', 'sending']);
      
      const existingTypes = new Set((existingMessages || []).map(m => m.message_type));
      
      // Create scheduled messages for each step
      const messagesToCreate = [];
      for (const step of sequenceData.steps) {
        const typeKey = step.time_label || `step_${step.step_order}`;
        
        // Skip if already scheduled
        if (existingTypes.has(typeKey)) continue;
        
        // Parse send_time (format: "HH:MM:SS")
        const [hours, minutes, seconds] = step.send_time.split(':').map(Number);
        let scheduledFor = new Date(workshopDate);
        scheduledFor = setHours(scheduledFor, hours);
        scheduledFor = setMinutes(scheduledFor, minutes);
        scheduledFor = setSeconds(scheduledFor, seconds || 0);
        
        // Skip if scheduled time is in the past
        if (isBefore(scheduledFor, now)) continue;
        
        // Apply template variables
        const templateContent = step.template?.content || '';
        const processedContent = templateContent
          .replace(/{workshop_name}/g, workshop.title)
          .replace(/{date}/g, format(workshopDate, 'MMMM d, yyyy'))
          .replace(/{time}/g, format(workshopDate, 'h:mm a'));
        
        messagesToCreate.push({
          organization_id: currentOrganization.id,
          group_id: workshop.whatsapp_group_id,
          workshop_id: workshopId,
          message_type: typeKey,
          message_content: processedContent,
          media_url: step.template?.media_url || null,
          scheduled_for: scheduledFor.toISOString(),
          status: 'pending' as const,
        });
      }
      
      if (messagesToCreate.length === 0) {
        throw new Error('All message times are in the past or already scheduled');
      }
      
      // Insert all messages
      const { error: insertError } = await supabase
        .from('scheduled_whatsapp_messages')
        .insert(messagesToCreate);
      
      if (insertError) throw insertError;
      
      // Update workshop automation status
      await supabase
        .from('workshops')
        .update({
          automation_status: {
            whatsapp_group_linked: true,
            messages_scheduled: true,
          },
        })
        .eq('id', workshopId);
      
      return { scheduled: messagesToCreate.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workshop-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['workshop-messages'] });
      toast.success(`Scheduled ${data.scheduled} messages`);
    },
    onError: (error: Error) => {
      toast.error('Failed to schedule messages', { description: error.message });
    },
  });

  // Cancel a scheduled message
  const cancelMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from('scheduled_whatsapp_messages')
        .update({ status: 'cancelled' })
        .eq('id', messageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshop-messages'] });
      toast.success('Message cancelled');
    },
    onError: (error: Error) => {
      toast.error('Failed to cancel message', { description: error.message });
    },
  });

  return {
    workshops: workshops || [],
    workshopsLoading,
    error,
    useWorkshopMessages,
    subscribeToMessages,
    updateTag: updateTagMutation.mutate,
    isUpdatingTag: updateTagMutation.isPending,
    updateSession: updateSessionMutation.mutate,
    isUpdatingSession: updateSessionMutation.isPending,
    updateGroup: updateGroupMutation.mutate,
    isUpdatingGroup: updateGroupMutation.isPending,
    runMessaging: runMessagingMutation.mutate,
    isRunningMessaging: runMessagingMutation.isPending,
    cancelMessage: cancelMessageMutation.mutate,
    isCancellingMessage: cancelMessageMutation.isPending,
  };
}
