import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';
import { format, setHours, setMinutes, setSeconds, isBefore } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { DEFAULT_TIMEZONE } from '@/lib/timezoneUtils';

export interface ScheduledSMSMessage {
  id: string;
  organization_id: string;
  workshop_id: string;
  lead_id: string;
  template_id: string;
  variable_values: Record<string, string> | null;
  scheduled_for: string;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled';
  sent_at: string | null;
  error_message: string | null;
  fast2sms_request_id: string | null;
  retry_count: number;
  created_at: string;
}

interface WorkshopForSMS {
  id: string;
  title: string;
  start_date: string;
  tag?: {
    id: string;
    name: string;
    sms_sequence_id: string | null;
  } | null;
}

// Standalone hook to fetch SMS messages for a workshop
export function useWorkshopSMSMessages(workshopId: string | null) {
  return useQuery({
    queryKey: ['workshop-sms-messages', workshopId],
    queryFn: async () => {
      if (!workshopId) return [];
      
      const { data, error } = await supabase
        .from('scheduled_sms_messages')
        .select('*')
        .eq('workshop_id', workshopId)
        .order('scheduled_for', { ascending: true });

      if (error) throw error;
      return data as ScheduledSMSMessage[];
    },
    enabled: !!workshopId,
  });
}

export function useSMSNotification() {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const orgTimezone = currentOrganization?.timezone || DEFAULT_TIMEZONE;

  // Subscribe to real-time updates for SMS messages
  const subscribeToSMSMessages = (workshopId: string) => {
    const channel = supabase
      .channel(`workshop-sms-messages-${workshopId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scheduled_sms_messages',
          filter: `workshop_id=eq.${workshopId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['workshop-sms-messages', workshopId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  // Get registrants with phone numbers for a workshop
  const getWorkshopRegistrantsWithPhone = async (workshopId: string) => {
    // Get leads from workshop via lead_assignments
    const { data: assignments, error } = await supabase
      .from('lead_assignments')
      .select(`
        lead_id,
        leads!inner(id, contact_name, phone)
      `)
      .eq('workshop_id', workshopId);

    if (error) throw error;

    // Filter leads that have a phone number
    const leadsWithPhone = (assignments || [])
      .map((a: { leads: { id: string; contact_name: string; phone: string | null } }) => a.leads)
      .filter((l: { phone: string | null }) => l?.phone && l.phone.trim() !== '');

    return leadsWithPhone;
  };

  // Run SMS sequence for a workshop
  const runSMSSequenceMutation = useMutation({
    mutationFn: async ({
      workshopId,
      workshop,
      manualVariables = {},
    }: {
      workshopId: string;
      workshop: WorkshopForSMS;
      manualVariables?: Record<string, string>;
    }) => {
      if (!currentOrganization) throw new Error('No organization selected');
      if (!workshop.tag?.sms_sequence_id) throw new Error('No SMS sequence assigned to the tag');

      // Fetch the sequence with steps
      const { data: sequenceData, error: seqError } = await supabase
        .from('sms_sequences')
        .select(`
          *,
          steps:sms_sequence_steps(
            *,
            template:sms_templates(id, name, dlt_template_id, variables)
          )
        `)
        .eq('id', workshop.tag.sms_sequence_id)
        .single();

      if (seqError) throw seqError;
      if (!sequenceData?.steps?.length) throw new Error('Sequence has no steps configured');

      // Get registrants with phone numbers
      const registrants = await getWorkshopRegistrantsWithPhone(workshopId);
      if (registrants.length === 0) {
        throw new Error('No registrants with phone numbers found');
      }

      // Parse workshop date in org timezone
      const workshopDateStr = workshop.start_date;
      const workshopDateInOrgTz = toZonedTime(new Date(workshopDateStr), orgTimezone);
      const now = new Date();

      // Check for existing scheduled messages
      const { data: existingMessages } = await supabase
        .from('scheduled_sms_messages')
        .select('template_id, lead_id')
        .eq('workshop_id', workshopId)
        .in('status', ['pending', 'sending']);

      const existingCombos = new Set(
        (existingMessages || []).map(m => `${m.template_id}|${m.lead_id}`)
      );

      // Create scheduled messages for each step for each registrant
      const messagesToCreate = [];
      
      for (const step of sequenceData.steps) {
        const template = step.template;
        if (!template) continue;

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

        // Build variable values from template variables
        const variableValues: Record<string, string> = {};
        const templateVars = template.variables as { key: string; label: string }[] | null;
        if (templateVars && Array.isArray(templateVars)) {
          for (const v of templateVars) {
            const key = v.key;
            // Try to use manual variables or auto-fill common ones
            if (manualVariables[key]) {
              variableValues[key] = manualVariables[key];
            } else if (key === 'workshop_name' || v.label?.toLowerCase().includes('workshop')) {
              variableValues[key] = workshop.title;
            } else if (key === 'date' || v.label?.toLowerCase().includes('date')) {
              variableValues[key] = format(workshopDateInOrgTz, 'MMMM d, yyyy');
            } else if (key === 'time' || v.label?.toLowerCase().includes('time')) {
              variableValues[key] = format(workshopDateInOrgTz, 'h:mm a');
            }
          }
        }

        // Create message for each registrant
        for (const lead of registrants) {
          // Skip if already scheduled
          if (existingCombos.has(`${template.id}|${lead.id}`)) continue;

          // Add lead name to variables if applicable
          const leadVariables = { ...variableValues };
          if (templateVars?.some(v => 
            v.key === 'name' || v.label?.toLowerCase().includes('name')
          )) {
            const nameVar = templateVars.find(v => 
              v.key === 'name' || v.label?.toLowerCase().includes('name')
            );
            if (nameVar) {
              leadVariables[nameVar.key] = lead.contact_name || 'there';
            }
          }

          messagesToCreate.push({
            organization_id: currentOrganization.id,
            workshop_id: workshopId,
            lead_id: lead.id,
            template_id: template.id,
            variable_values: leadVariables,
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
        .from('scheduled_sms_messages')
        .insert(messagesToCreate);

      if (insertError) throw insertError;

      return { 
        scheduled: messagesToCreate.length, 
        registrantCount: registrants.length,
        stepCount: sequenceData.steps.length,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workshop-sms-messages'] });
      toast.success(`Scheduled ${data.scheduled} SMS messages for ${data.registrantCount} registrants`);
    },
    onError: (error: Error) => {
      toast.error('Failed to schedule SMS messages', { description: error.message });
    },
  });

  // Cancel a scheduled SMS message
  const cancelSMSMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from('scheduled_sms_messages')
        .update({ status: 'cancelled' })
        .eq('id', messageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshop-sms-messages'] });
      toast.success('SMS cancelled');
    },
    onError: (error: Error) => {
      toast.error('Failed to cancel SMS', { description: error.message });
    },
  });

  return {
    orgTimezone,
    subscribeToSMSMessages,
    getWorkshopRegistrantsWithPhone,
    // Mutations
    runSMSSequence: runSMSSequenceMutation.mutateAsync,
    isRunningSMSSequence: runSMSSequenceMutation.isPending,
    cancelSMS: cancelSMSMutation.mutate,
    isCancellingSMS: cancelSMSMutation.isPending,
  };
}
