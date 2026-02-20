import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';
import { format, setHours, setMinutes, setSeconds, isBefore } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { DEFAULT_TIMEZONE } from '@/lib/timezoneUtils';
import { getMediaTypeFromUrl } from '@/lib/mediaUtils';

export interface WebinarScheduledMessage {
  id: string;
  organization_id: string;
  group_id: string;
  webinar_id: string;
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

export interface WebinarWithDetails {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  organization_id: string;
  tag_id: string | null;
  whatsapp_group_id: string | null;
  whatsapp_session_id: string | null;
  community_group_id: string | null;
  automation_status: {
    whatsapp_group_linked: boolean;
    messages_scheduled: boolean;
  };
  status: string;
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
}

export function useWebinarNotification() {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const orgTimezone = currentOrganization?.timezone || DEFAULT_TIMEZONE;

  const { data: webinars, isLoading: webinarsLoading, error } = useQuery({
    queryKey: ['webinar-notifications', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      
      const { data, error } = await supabase
        .from('webinars')
        .select(`
          id, title, description, start_date, end_date, organization_id, tag_id, 
          whatsapp_group_id, whatsapp_session_id, community_group_id, automation_status, status,
          tag:workshop_tags(id, name, color, template_sequence_id),
          whatsapp_group:whatsapp_groups!webinars_whatsapp_group_id_fkey(id, group_name, group_jid)
        `)
        .eq('organization_id', currentOrganization.id)
        .order('start_date', { ascending: false });

      if (error) throw error;
      return (data || []) as WebinarWithDetails[];
    },
    enabled: !!currentOrganization,
  });

  const subscribeToMessages = (webinarId: string) => {
    const channel = supabase
      .channel(`webinar-messages-${webinarId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scheduled_webinar_messages',
          filter: `webinar_id=eq.${webinarId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['webinar-messages', webinarId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const updateTagMutation = useMutation({
    mutationFn: async ({ webinarId, tagId }: { webinarId: string; tagId: string | null }) => {
      const { error } = await supabase
        .from('webinars')
        .update({ tag_id: tagId })
        .eq('id', webinarId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webinar-notifications'] });
      toast.success('Webinar tag updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update tag', { description: error.message });
    },
  });

  const updateSessionMutation = useMutation({
    mutationFn: async ({ webinarId, sessionId }: { webinarId: string; sessionId: string | null }) => {
      const { error } = await supabase
        .from('webinars')
        .update({ whatsapp_session_id: sessionId })
        .eq('id', webinarId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webinar-notifications'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to update WhatsApp account', { description: error.message });
    },
  });

  const updateGroupsMutation = useMutation({
    mutationFn: async ({ webinarId, groupIds }: { webinarId: string; groupIds: string[] }) => {
      if (!currentOrganization) throw new Error('No organization selected');
      
      const { error: deleteError } = await supabase
        .from('webinar_whatsapp_groups')
        .delete()
        .eq('webinar_id', webinarId);
      if (deleteError) throw deleteError;
      
      if (groupIds.length > 0) {
        const { error: insertError } = await supabase
          .from('webinar_whatsapp_groups')
          .insert(groupIds.map(groupId => ({ webinar_id: webinarId, group_id: groupId })));
        if (insertError) throw insertError;
      }
      
      const { error: updateError } = await supabase
        .from('webinars')
        .update({ 
          whatsapp_group_id: groupIds[0] || null,
          automation_status: { whatsapp_group_linked: groupIds.length > 0, messages_scheduled: false },
        })
        .eq('id', webinarId);
      if (updateError) throw updateError;
      
      return { groupCount: groupIds.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['webinar-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['webinar-whatsapp-groups'] });
      toast.success(`${data.groupCount} group${data.groupCount !== 1 ? 's' : ''} linked`);
    },
    onError: (error: Error) => {
      toast.error('Failed to link groups', { description: error.message });
    },
  });

  const runMessagingMutation = useMutation({
    mutationFn: async ({ 
      webinarId, webinar, groupIds, manualVariables = {},
    }: { 
      webinarId: string; 
      webinar: WebinarWithDetails;
      groupIds: string[];
      manualVariables?: Record<string, string>;
    }) => {
      if (!currentOrganization) throw new Error('No organization selected');
      if (!groupIds || groupIds.length === 0) throw new Error('No WhatsApp groups selected');
      if (!webinar.tag?.template_sequence_id) throw new Error('No template sequence assigned to the tag');
      
      const { data: sequenceData, error: seqError } = await supabase
        .from('template_sequences')
        .select(`*, steps:template_sequence_steps(*, template:whatsapp_message_templates(id, name, content, media_url))`)
        .eq('id', webinar.tag.template_sequence_id)
        .single();
      
      if (seqError) throw seqError;
      if (!sequenceData?.steps?.length) throw new Error('Sequence has no steps configured');
      
      const webinarDateInOrgTz = toZonedTime(new Date(webinar.start_date), orgTimezone);
      const now = new Date();
      
      const { data: existingMessages } = await supabase
        .from('scheduled_webinar_messages')
        .select('message_type, group_id')
        .eq('webinar_id', webinarId)
        .in('status', ['pending', 'sending']);
      
      const existingCombos = new Set((existingMessages || []).map(m => `${m.message_type}|${m.group_id}`));
      
      const messagesToCreate = [];
      for (const step of sequenceData.steps) {
        const typeKey = step.time_label || `step_${step.step_order}`;
        const [hours, minutes, seconds] = step.send_time.split(':').map(Number);
        
        let scheduledInOrgTz = new Date(webinarDateInOrgTz);
        scheduledInOrgTz = setHours(scheduledInOrgTz, hours);
        scheduledInOrgTz = setMinutes(scheduledInOrgTz, minutes);
        scheduledInOrgTz = setSeconds(scheduledInOrgTz, seconds || 0);
        
        const scheduledForUTC = fromZonedTime(scheduledInOrgTz, orgTimezone);
        if (isBefore(scheduledForUTC, now)) continue;
        
        const templateContent = step.template?.content || '';
        let processedContent = templateContent
          .replace(/{webinar_name}/gi, webinar.title)
          .replace(/{workshop_name}/gi, webinar.title)
          .replace(/{date}/gi, format(webinarDateInOrgTz, 'MMMM d, yyyy'))
          .replace(/{time}/gi, format(webinarDateInOrgTz, 'h:mm a'));
        
        for (const [key, value] of Object.entries(manualVariables)) {
          processedContent = processedContent.replace(new RegExp(`\\{${key}\\}`, 'gi'), value);
        }
        
        for (const groupId of groupIds) {
          if (existingCombos.has(`${typeKey}|${groupId}`)) continue;
          const templateMediaUrl = step.template?.media_url || null;
          messagesToCreate.push({
            organization_id: currentOrganization.id,
            group_id: groupId,
            webinar_id: webinarId,
            message_type: typeKey,
            message_content: processedContent,
            media_url: templateMediaUrl,
            media_type: getMediaTypeFromUrl(templateMediaUrl),
            scheduled_for: scheduledForUTC.toISOString(),
            status: 'pending' as const,
          });
        }
      }
      
      if (messagesToCreate.length === 0) throw new Error('All message times are in the past or already scheduled');
      
      const { error: insertError } = await supabase
        .from('scheduled_webinar_messages')
        .insert(messagesToCreate);
      if (insertError) throw insertError;
      
      await supabase
        .from('webinars')
        .update({ automation_status: { whatsapp_group_linked: true, messages_scheduled: true } })
        .eq('id', webinarId);
      
      return { scheduled: messagesToCreate.length, groupCount: groupIds.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['webinar-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['webinar-messages'] });
      toast.success(`Scheduled ${data.scheduled} messages across ${data.groupCount} group${data.groupCount !== 1 ? 's' : ''}`);
    },
    onError: (error: Error) => {
      toast.error('Failed to schedule messages', { description: error.message });
    },
  });

  const cancelMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from('scheduled_webinar_messages')
        .update({ status: 'cancelled' })
        .eq('id', messageId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webinar-messages'] });
      toast.success('Message cancelled');
    },
    onError: (error: Error) => {
      toast.error('Failed to cancel message', { description: error.message });
    },
  });

  const sendMessageNowMutation = useMutation({
    mutationFn: async ({
      webinarId, groupId, sessionId, templateId, content, mediaUrl,
    }: {
      webinarId: string; groupId: string; sessionId: string;
      templateId: string; content: string; mediaUrl?: string | null;
    }) => {
      const { data: group, error: groupError } = await supabase
        .from('whatsapp_groups')
        .select('group_jid')
        .eq('id', groupId)
        .single();
      if (groupError || !group?.group_jid) throw new Error('Group not found');

      const { data: session, error: sessionError } = await supabase
        .from('whatsapp_sessions')
        .select('session_data')
        .eq('id', sessionId)
        .single();
      if (sessionError || !session?.session_data) throw new Error('WhatsApp session not found');

      const sessionData = session.session_data as { vps_session_id?: string };
      if (!sessionData?.vps_session_id) throw new Error('WhatsApp session is not properly configured');
      
      const detectedMediaType = getMediaTypeFromUrl(mediaUrl);
      const { data, error } = await supabase.functions.invoke('vps-whatsapp-proxy', {
        body: {
          action: 'send',
          sessionId,
          groupId: group.group_jid,
          message: content,
          ...(mediaUrl && { mediaUrl }),
          ...(mediaUrl && detectedMediaType && { mediaType: detectedMediaType }),
        },
      });
      
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to send message');
      return data;
    },
    onSuccess: () => {
      toast.success('Message sent successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to send message', { description: error.message });
    },
  });

  const deleteWebinarMutation = useMutation({
    mutationFn: async (webinarId: string) => {
      // Scheduled messages and groups are ON DELETE CASCADE, but sequence vars too
      const { error: messagesError } = await supabase
        .from('scheduled_webinar_messages')
        .delete()
        .eq('webinar_id', webinarId);
      if (messagesError) throw messagesError;
      
      const { error: groupsError } = await supabase
        .from('webinar_whatsapp_groups')
        .delete()
        .eq('webinar_id', webinarId);
      if (groupsError) throw groupsError;
      
      const { error: varsError } = await supabase
        .from('webinar_sequence_variables')
        .delete()
        .eq('webinar_id', webinarId);
      if (varsError) throw varsError;
      
      const { error: webinarError } = await supabase
        .from('webinars')
        .delete()
        .eq('id', webinarId);
      if (webinarError) throw webinarError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webinar-notifications'] });
      toast.success('Webinar deleted successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete webinar', { description: error.message });
    },
  });

  const createCommunityMutation = useMutation({
    mutationFn: async ({ webinarId, webinarTitle }: { webinarId: string; webinarTitle: string }) => {
      if (!currentOrganization) throw new Error('No organization selected');
      
      const { data, error } = await supabase.functions.invoke('create-webinar-community', {
        body: {
          webinarId,
          webinarName: webinarTitle,
          organizationId: currentOrganization.id,
        },
      });
      
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to create community');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['webinar-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['webinar-whatsapp-groups'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-groups'] });
      toast.success('WhatsApp community created', {
        description: data.groupName ? `Created "${data.groupName}"` : undefined,
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to create community', { description: error.message });
    },
  });

  const createWebinarMutation = useMutation({
    mutationFn: async ({ title, startDate, endDate, tagId }: {
      title: string; startDate: string; endDate: string; tagId: string | null;
    }) => {
      if (!currentOrganization) throw new Error('No organization selected');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('webinars')
        .insert({
          title,
          start_date: startDate,
          end_date: endDate,
          tag_id: tagId,
          organization_id: currentOrganization.id,
          created_by: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['webinar-notifications'] });
      toast.success('Webinar created');
      
      // Fire-and-forget community creation if tag is set
      if (data.tag_id) {
        createCommunityMutation.mutate({ webinarId: data.id, webinarTitle: data.title });
      }
    },
    onError: (error: Error) => {
      toast.error('Failed to create webinar', { description: error.message });
    },
  });

  return {
    webinars: webinars || [],
    webinarsLoading,
    error,
    orgTimezone,
    subscribeToMessages,
    updateTag: updateTagMutation.mutate,
    isUpdatingTag: updateTagMutation.isPending,
    updateSession: updateSessionMutation.mutate,
    isUpdatingSession: updateSessionMutation.isPending,
    updateGroups: updateGroupsMutation.mutate,
    isUpdatingGroups: updateGroupsMutation.isPending,
    runMessaging: runMessagingMutation.mutate,
    isRunningMessaging: runMessagingMutation.isPending,
    cancelMessage: cancelMessageMutation.mutate,
    isCancellingMessage: cancelMessageMutation.isPending,
    sendMessageNow: sendMessageNowMutation.mutateAsync,
    isSendingNow: sendMessageNowMutation.isPending,
    deleteWebinar: deleteWebinarMutation.mutate,
    isDeletingWebinar: deleteWebinarMutation.isPending,
    createCommunity: createCommunityMutation.mutate,
    isCreatingCommunity: createCommunityMutation.isPending,
    createWebinar: createWebinarMutation.mutateAsync,
    isCreatingWebinar: createWebinarMutation.isPending,
  };
}

// Standalone hooks
export function useWebinarMessages(webinarId: string | null) {
  return useQuery({
    queryKey: ['webinar-messages', webinarId],
    queryFn: async () => {
      if (!webinarId) return [];
      const { data, error } = await supabase
        .from('scheduled_webinar_messages')
        .select('*')
        .eq('webinar_id', webinarId)
        .order('scheduled_for', { ascending: true });
      if (error) throw error;
      return data as WebinarScheduledMessage[];
    },
    enabled: !!webinarId,
  });
}

export function useWebinarGroups(webinarId: string | null) {
  return useQuery({
    queryKey: ['webinar-whatsapp-groups', webinarId],
    queryFn: async () => {
      if (!webinarId) return [];
      const { data, error } = await supabase
        .from('webinar_whatsapp_groups')
        .select('id, group_id, created_at')
        .eq('webinar_id', webinarId);
      if (error) throw error;
      return data;
    },
    enabled: !!webinarId,
  });
}
