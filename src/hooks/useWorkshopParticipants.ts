import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RegisteredLead {
  id: string;
  contact_name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
}

interface LeftMember {
  id: string;
  phone_number: string;
  full_phone: string;
  joined_at: string;
  left_at: string | null;
  contact_name?: string;
  email?: string;
}

interface ActiveMember {
  id: string;
  phone_number: string;
  full_phone: string;
  joined_at: string;
  status: string;
}

interface UnregisteredMember {
  id: string;
  phone: string;
  fullPhone: string;
}

interface WorkshopParticipantsData {
  registered: RegisteredLead[];
  inGroup: RegisteredLead[];
  missing: RegisteredLead[];
  leftGroup: LeftMember[];
  unregistered: UnregisteredMember[];
  activeMembers: ActiveMember[];
  joinRate: number;
  totalRegistered: number;
  totalInGroup: number;
  totalMissing: number;
  totalLeftGroup: number;
  totalInGroupRaw: number;
  totalUnregistered: number;
  groupName: string | null;
  lastSynced: Date | null;
}

interface SyncResult {
  success: boolean;
  synced: number;
  marked_left: number;
  total_in_group: number;
  group_name?: string;
}

// Normalize phone number to last 10 digits for comparison
function normalizePhone(phone: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-10);
}

export function useWorkshopParticipants(
  workshopId: string,
  sessionId: string | null,
  groupJid: string | null,
  enabled: boolean = true
) {
  const queryClient = useQueryClient();

  // Subscribe to realtime changes on workshop_group_members
  useEffect(() => {
    if (!groupJid || !enabled) return;

    const channel = supabase
      .channel(`workshop-members-${groupJid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workshop_group_members',
          filter: `group_jid=eq.${groupJid}`,
        },
        (payload) => {
          console.log('Realtime update received:', payload);
          // Invalidate the query to refetch data
          queryClient.invalidateQueries({ 
            queryKey: ['workshop-participants', workshopId, sessionId, groupJid] 
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupJid, workshopId, sessionId, enabled, queryClient]);

  // Sync mutation - calls VPS to fetch current members and updates database
  const syncMutation = useMutation({
    mutationFn: async (): Promise<SyncResult> => {
      if (!sessionId || !groupJid) {
        throw new Error('Session ID and group JID are required');
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('vps-whatsapp-proxy', {
        body: {
          action: 'sync-members',
          sessionId,
          groupJid,
        },
      });

      if (response.error) {
        throw response.error;
      }

      return response.data as SyncResult;
    },
    onSuccess: (data) => {
      // Invalidate to refetch from database
      queryClient.invalidateQueries({ 
        queryKey: ['workshop-participants', workshopId, sessionId, groupJid] 
      });
      toast.success(`Synced ${data.synced} members${data.marked_left > 0 ? `, ${data.marked_left} marked as left` : ''}`);
    },
    onError: (error) => {
      console.error('Sync failed:', error);
      toast.error('Failed to sync members from WhatsApp');
    },
  });

  // Main query - fetches from DATABASE (not VPS)
  const query = useQuery<WorkshopParticipantsData | null>({
    queryKey: ['workshop-participants', workshopId, sessionId, groupJid],
    queryFn: async () => {
      if (!workshopId || !groupJid) {
        return null;
      }

      // 1. Fetch registered leads for this workshop
      const { data: assignments, error: assignmentsError } = await supabase
        .from('lead_assignments')
        .select(`
          lead_id,
          created_at,
          leads:lead_id (
            id,
            contact_name,
            email,
            phone
          )
        `)
        .eq('workshop_id', workshopId);

      if (assignmentsError) {
        console.error('Error fetching lead assignments:', assignmentsError);
        throw assignmentsError;
      }

      // Extract unique leads with phone numbers
      const registeredLeads: RegisteredLead[] = (assignments || [])
        .filter(a => a.leads)
        .map(a => ({
          id: (a.leads as any).id,
          contact_name: (a.leads as any).contact_name,
          email: (a.leads as any).email,
          phone: (a.leads as any).phone,
          created_at: a.created_at,
        }));

      // 2. Fetch ACTIVE members from database (populated by webhooks + sync)
      const { data: activeMembers, error: activeError } = await supabase
        .from('workshop_group_members')
        .select('id, phone_number, full_phone, joined_at, status, updated_at')
        .eq('group_jid', groupJid)
        .eq('status', 'active')
        .order('joined_at', { ascending: false });

      if (activeError) {
        console.error('Error fetching active members:', activeError);
      }

      // 3. Fetch LEFT members from database
      const { data: leftMembers, error: leftError } = await supabase
        .from('workshop_group_members')
        .select('id, phone_number, full_phone, joined_at, left_at')
        .eq('group_jid', groupJid)
        .eq('status', 'left')
        .order('left_at', { ascending: false });

      if (leftError) {
        console.error('Error fetching left members:', leftError);
      }

      // Map left members with lead info if available
      const leftWithLeadInfo: LeftMember[] = (leftMembers || []).map(member => {
        const matchedLead = registeredLeads.find(
          lead => normalizePhone(lead.phone) === member.phone_number
        );
        return {
          ...member,
          contact_name: matchedLead?.contact_name,
          email: matchedLead?.email || undefined,
        };
      });

      // 4. Create a set of normalized phone numbers from registered leads
      const registeredPhoneSet = new Set(
        registeredLeads.map(l => normalizePhone(l.phone))
      );

      // 5. Create a set of normalized phone numbers from active members in DB
      const activePhoneSet = new Set(
        (activeMembers || []).map(m => m.phone_number)
      );

      // 6. Compare registered leads against active members in database
      const inGroup: RegisteredLead[] = [];
      const missing: RegisteredLead[] = [];

      for (const lead of registeredLeads) {
        const normalizedPhone = normalizePhone(lead.phone);
        if (normalizedPhone && activePhoneSet.has(normalizedPhone)) {
          inGroup.push(lead);
        } else {
          missing.push(lead);
        }
      }

      // 7. Find unregistered members (in active DB members but not in leads)
      const unregistered: UnregisteredMember[] = (activeMembers || [])
        .filter(m => {
          const normalizedPhone = m.phone_number;
          return normalizedPhone && !registeredPhoneSet.has(normalizedPhone);
        })
        .map(m => ({
          id: m.id,
          phone: m.phone_number,
          fullPhone: m.full_phone,
        }));

      // 8. Calculate join rate
      const joinRate = registeredLeads.length > 0 
        ? (inGroup.length / registeredLeads.length) * 100 
        : 0;

      // 9. Total in group (raw count from database)
      const totalInGroupRaw = (activeMembers || []).length;

      // 10. Get last synced timestamp from most recent member update
      const lastSynced = activeMembers && activeMembers.length > 0
        ? new Date((activeMembers[0] as any).updated_at || activeMembers[0].joined_at)
        : null;

      return {
        registered: registeredLeads,
        inGroup,
        missing,
        leftGroup: leftWithLeadInfo,
        unregistered,
        activeMembers: (activeMembers || []) as ActiveMember[],
        joinRate,
        totalRegistered: registeredLeads.length,
        totalInGroup: inGroup.length,
        totalMissing: missing.length,
        totalLeftGroup: leftWithLeadInfo.length,
        totalInGroupRaw,
        totalUnregistered: unregistered.length,
        groupName: null, // Will be set from workshop's linked group
        lastSynced,
      };
    },
    enabled: enabled && !!workshopId && !!groupJid,
    // REMOVED: refetchInterval - no more polling!
    staleTime: 60000, // Consider data stale after 1 minute
  });

  return {
    ...query,
    syncMembers: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
  };
}
