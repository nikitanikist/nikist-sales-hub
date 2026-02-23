import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';
import { format, setHours, setMinutes, setSeconds, isBefore } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { DEFAULT_TIMEZONE } from '@/lib/timezoneUtils';
import { getMediaTypeFromUrl } from '@/lib/mediaUtils';
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
    sms_sequence_id: string | null;
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

  // Get organization timezone with fallback
  const orgTimezone = currentOrganization?.timezone || DEFAULT_TIMEZONE;

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
          tag:workshop_tags(id, name, color, template_sequence_id, sms_sequence_id),
          whatsapp_group:whatsapp_groups!workshops_whatsapp_group_id_fkey(id, group_name, group_jid)
        `)
        .eq('organization_id', currentOrganization.id)
        .order('start_date', { ascending: false });

      if (workshopsError) throw workshopsError;
      
      // If no workshops, return empty array
      if (!workshopsData || workshopsData.length === 0) return [];
      
      // Fetch registration counts using database aggregation (avoids 1000-row limit)
      const { data: metricsData, error: metricsError } = await supabase
        .rpc('get_workshop_metrics');
      
      if (metricsError) {
        console.error('Error fetching workshop metrics:', metricsError);
      }
      
      // Create lookup map from metrics
      const countMap: Record<string, number> = {};
      (metricsData || []).forEach((m: { workshop_id: string; registration_count: number }) => {
        countMap[m.workshop_id] = Number(m.registration_count) || 0;
      });
      
      return (workshopsData || []).map(w => ({
        ...w,
        registrations_count: countMap[w.id] || 0,
      })) as WorkshopWithDetails[];
    },
    enabled: !!currentOrganization,
  });
  // NOTE: useWorkshopMessages and useWorkshopGroups are defined as standalone exported hooks below
  // They should NOT be defined inside this hook to avoid "Rendered more hooks" errors

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

  // Update workshop WhatsApp group (legacy - single group)
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

  // Update workshop WhatsApp groups (multi-group via junction table)
  const updateGroupsMutation = useMutation({
    mutationFn: async ({ workshopId, groupIds }: { workshopId: string; groupIds: string[] }) => {
      if (!currentOrganization) throw new Error('No organization selected');
      
      // Delete existing links for this workshop
      const { error: deleteError } = await supabase
        .from('workshop_whatsapp_groups')
        .delete()
        .eq('workshop_id', workshopId);
      
      if (deleteError) throw deleteError;
      
      // Insert new links
      if (groupIds.length > 0) {
        const linksToInsert = groupIds.map(groupId => ({
          workshop_id: workshopId,
          group_id: groupId,
        }));
        
        const { error: insertError } = await supabase
          .from('workshop_whatsapp_groups')
          .insert(linksToInsert);
        
        if (insertError) throw insertError;
      }
      
      // Also update the legacy whatsapp_group_id field for backwards compatibility
      // Use the first selected group
      const { error: updateError } = await supabase
        .from('workshops')
        .update({ 
          whatsapp_group_id: groupIds[0] || null,
          automation_status: {
            whatsapp_group_linked: groupIds.length > 0,
            messages_scheduled: false,
          },
        })
        .eq('id', workshopId);
      
      if (updateError) throw updateError;
      
      return { groupCount: groupIds.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workshop-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['workshop-whatsapp-groups'] });
      toast.success(`${data.groupCount} group${data.groupCount !== 1 ? 's' : ''} linked`);
    },
    onError: (error: Error) => {
      toast.error('Failed to link groups', { description: error.message });
    },
  });

  // Run the messaging - schedule all messages based on tag's sequence for multiple groups
  const runMessagingMutation = useMutation({
    mutationFn: async ({ 
      workshopId, 
      workshop,
      groupIds,
      manualVariables = {},
    }: { 
      workshopId: string; 
      workshop: WorkshopWithDetails;
      groupIds: string[];
      manualVariables?: Record<string, string>;
    }) => {
      if (!currentOrganization) throw new Error('No organization selected');
      if (!groupIds || groupIds.length === 0) throw new Error('No WhatsApp groups selected');
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
      
      // Parse workshop date - interpret as org timezone
      const workshopDateStr = workshop.start_date;
      const workshopDateInOrgTz = toZonedTime(new Date(workshopDateStr), orgTimezone);
      
      const now = new Date();
      
      // Check for existing scheduled messages to avoid duplicates
      // Now we check per group
      const { data: existingMessages } = await supabase
        .from('scheduled_whatsapp_messages')
        .select('message_type, group_id')
        .eq('workshop_id', workshopId)
        .in('status', ['pending', 'sending']);
      
      // Create a set of existing type+group combinations
      const existingCombos = new Set(
        (existingMessages || []).map(m => `${m.message_type}|${m.group_id}`)
      );
      
      // Create scheduled messages for each step for each group
      const messagesToCreate = [];
      for (const step of sequenceData.steps) {
        const typeKey = step.time_label || `step_${step.step_order}`;
        
        // Parse send_time (format: "HH:MM:SS")
        const [hours, minutes, seconds] = step.send_time.split(':').map(Number);
        
        // Create the scheduled time in org timezone
        let scheduledInOrgTz = new Date(workshopDateInOrgTz);
        scheduledInOrgTz = setHours(scheduledInOrgTz, hours);
        scheduledInOrgTz = setMinutes(scheduledInOrgTz, minutes);
        scheduledInOrgTz = setSeconds(scheduledInOrgTz, seconds || 0);
        
        // Convert to UTC for storage
        const scheduledForUTC = fromZonedTime(scheduledInOrgTz, orgTimezone);
        
        // Skip if scheduled time is in the past
        if (isBefore(scheduledForUTC, now)) continue;
        
        // Apply template variables - format dates in org timezone
        const templateContent = step.template?.content || '';
        let processedContent = templateContent
          .replace(/{workshop_name}/gi, workshop.title)
          .replace(/{date}/gi, format(workshopDateInOrgTz, 'MMMM d, yyyy'))
          .replace(/{time}/gi, format(workshopDateInOrgTz, 'h:mm a'));
        
        // Apply manual variables
        for (const [key, value] of Object.entries(manualVariables)) {
          processedContent = processedContent.replace(
            new RegExp(`\\{${key}\\}`, 'gi'),
            value
          );
        }
        
        // Create a message for EACH selected group
        for (const groupId of groupIds) {
          // Skip if already scheduled for this group
          if (existingCombos.has(`${typeKey}|${groupId}`)) continue;
          
          const templateMediaUrl = step.template?.media_url || null;
          messagesToCreate.push({
            organization_id: currentOrganization.id,
            group_id: groupId,
            workshop_id: workshopId,
            message_type: typeKey,
            message_content: processedContent,
            media_url: templateMediaUrl,
            media_type: getMediaTypeFromUrl(templateMediaUrl),
            scheduled_for: scheduledForUTC.toISOString(),
            status: 'pending' as const,
          });
        }
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
      
      return { scheduled: messagesToCreate.length, groupCount: groupIds.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workshop-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['workshop-messages'] });
      toast.success(`Scheduled ${data.scheduled} messages across ${data.groupCount} group${data.groupCount !== 1 ? 's' : ''}`);
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

  // Send a message immediately
  const sendMessageNowMutation = useMutation({
    mutationFn: async ({
      workshopId,
      groupId,
      sessionId,
      templateId,
      content,
      mediaUrl,
    }: {
      workshopId: string;
      groupId: string;
      sessionId: string;
      templateId: string;
      content: string;
      mediaUrl?: string | null;
    }) => {
      // Get the group JID from the database
      const { data: group, error: groupError } = await supabase
        .from('whatsapp_groups')
        .select('group_jid')
        .eq('id', groupId)
        .single();
      
      if (groupError || !group?.group_jid) {
        throw new Error('Group not found');
      }

      // Get the session's VPS session ID and verify it's connected
      const { data: session, error: sessionError } = await supabase
        .from('whatsapp_sessions')
        .select('session_data, status')
        .eq('id', sessionId)
        .single();

      if (sessionError || !session?.session_data) {
        throw new Error('WhatsApp session not found');
      }

      // Check session is connected before attempting to send
      if (session.status !== 'connected') {
        throw new Error('WhatsApp session is disconnected. Please select a different session in the workshop settings.');
      }

      // Verify session has VPS ID configured (edge function will look it up)
      const sessionData = session.session_data as { vps_session_id?: string };
      if (!sessionData?.vps_session_id) {
        throw new Error('WhatsApp session is not properly configured');
      }
      
      // Call VPS proxy with local DB UUID - edge function handles VPS ID lookup
      const detectedMediaType = getMediaTypeFromUrl(mediaUrl);
      const { data, error } = await supabase.functions.invoke('vps-whatsapp-proxy', {
        body: {
          action: 'send',
          sessionId: sessionId,  // Send local DB UUID, not VPS session ID
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

  // Delete a workshop and its related data
  const deleteWorkshopMutation = useMutation({
    mutationFn: async (workshopId: string) => {
      // Delete scheduled messages first
      const { error: messagesError } = await supabase
        .from('scheduled_whatsapp_messages')
        .delete()
        .eq('workshop_id', workshopId);
      
      if (messagesError) throw messagesError;
      
      // Delete workshop-group links
      const { error: groupsError } = await supabase
        .from('workshop_whatsapp_groups')
        .delete()
        .eq('workshop_id', workshopId);
      
      if (groupsError) throw groupsError;
      
      // Delete sequence variables
      const { error: varsError } = await supabase
        .from('workshop_sequence_variables')
        .delete()
        .eq('workshop_id', workshopId);
      
      if (varsError) throw varsError;
      
      // Finally delete the workshop
      const { error: workshopError } = await supabase
        .from('workshops')
        .delete()
        .eq('id', workshopId);
      
      if (workshopError) throw workshopError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshop-notifications'] });
      toast.success('Workshop deleted successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete workshop', { description: error.message });
    },
  });

  // Create WhatsApp community group for a workshop
  const createCommunityMutation = useMutation({
    mutationFn: async ({ workshopId, workshopTitle }: { workshopId: string; workshopTitle: string }) => {
      if (!currentOrganization) throw new Error('No organization selected');
      
      const { data, error } = await supabase.functions.invoke('create-whatsapp-community', {
        body: {
          workshopId,
          workshopName: workshopTitle,
          organizationId: currentOrganization.id,
        },
      });
      
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to create community');
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workshop-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['workshop-whatsapp-groups'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-groups'] });
      toast.success('WhatsApp community created', {
        description: data.groupName ? `Created "${data.groupName}"` : undefined,
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to create community', { description: error.message });
    },
  });

  return {
    workshops: workshops || [],
    workshopsLoading,
    error,
    orgTimezone,
    subscribeToMessages,
    updateTag: updateTagMutation.mutate,
    isUpdatingTag: updateTagMutation.isPending,
    updateSession: updateSessionMutation.mutate,
    isUpdatingSession: updateSessionMutation.isPending,
    updateGroup: updateGroupMutation.mutate,
    isUpdatingGroup: updateGroupMutation.isPending,
    updateGroups: updateGroupsMutation.mutate,
    isUpdatingGroups: updateGroupsMutation.isPending,
    runMessaging: runMessagingMutation.mutate,
    isRunningMessaging: runMessagingMutation.isPending,
    cancelMessage: cancelMessageMutation.mutate,
    isCancellingMessage: cancelMessageMutation.isPending,
    sendMessageNow: sendMessageNowMutation.mutateAsync,
    isSendingNow: sendMessageNowMutation.isPending,
    deleteWorkshop: deleteWorkshopMutation.mutate,
    isDeletingWorkshop: deleteWorkshopMutation.isPending,
    createCommunity: createCommunityMutation.mutate,
    isCreatingCommunity: createCommunityMutation.isPending,
  };
}

// Standalone hooks - must be called at component level, not inside other hooks
export function useWorkshopMessages(workshopId: string | null) {
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
}

export function useWorkshopGroups(workshopId: string | null) {
  return useQuery({
    queryKey: ['workshop-whatsapp-groups', workshopId],
    queryFn: async () => {
      if (!workshopId) return [];
      
      const { data, error } = await supabase
        .from('workshop_whatsapp_groups')
        .select('id, group_id, created_at')
        .eq('workshop_id', workshopId);

      if (error) throw error;
      return data;
    },
    enabled: !!workshopId,
  });
}
